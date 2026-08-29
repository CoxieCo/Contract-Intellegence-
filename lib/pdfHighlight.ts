// Locates a quoted passage within a PDF page's extracted text items (pdf.js's
// getTextContent, via react-pdf's onGetTextSuccess) so PdfViewer can
// highlight the exact source text behind a citation — not just jump to the
// right page. See app/components/PdfViewer.tsx for how this is wired into
// react-pdf's customTextRenderer.
//
// Matching is fuzzy on purpose: the quote comes from either the app's own
// analyze extraction (SourcedValue.value, ThingToWatch.quote) or Ask's
// Claude call, neither of which is guaranteed to reproduce pdf.js's own
// text-item tokenization byte-for-byte (whitespace runs, smart vs straight
// quotes, line-wrap boundaries). A failed match degrades to "no highlight,
// just the page" — never a wrong highlight, never a crash.

export interface HighlightTextItem {
  str: string;
  hasEOL: boolean;
}

export interface HighlightRange {
  itemIndex: number;
  start: number; // inclusive, offset within that item's own str
  end: number; // exclusive
}

function normalizeChar(c: string): string {
  if (c === "‘" || c === "’") return "'";
  if (c === "“" || c === "”") return '"';
  return c.toLowerCase();
}

// Collapses whitespace runs to a single space and normalizes quote
// characters/case, while recording — for every character of the output —
// which index in the ORIGINAL string it came from. That mapping is what
// lets a match found in the collapsed text be translated back to real
// offsets in the un-collapsed original, without which a single doubled
// space anywhere before a match would throw off every offset after it.
function collapseWithMapping(s: string): { collapsed: string; originalIndex: number[] } {
  let collapsed = "";
  const originalIndex: number[] = [];
  let inWhitespace = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/\s/.test(c)) {
      if (!inWhitespace) {
        collapsed += " ";
        originalIndex.push(i);
        inWhitespace = true;
      }
      // additional consecutive whitespace chars contribute no more output
    } else {
      collapsed += normalizeChar(c);
      originalIndex.push(i);
      inWhitespace = false;
    }
  }
  return { collapsed, originalIndex };
}

// Joins a page's text items into one contiguous string (a space, or a
// newline after a line-ending item, between each pair) plus the [start,
// end) range each item occupies within it — the same kind of reconstruction
// app/api/analyze/route.ts's pageMarkedText does with "\n" between pages,
// just at the item level within a single page.
function joinItems(items: HighlightTextItem[]): { joined: string; spans: { start: number; end: number }[] } {
  let joined = "";
  const spans: { start: number; end: number }[] = [];
  for (const item of items) {
    const start = joined.length;
    joined += item.str;
    spans.push({ start, end: joined.length });
    joined += item.hasEOL ? "\n" : " ";
  }
  return { joined, spans };
}

// Below this, a match is too likely to land on an unrelated short phrase
// elsewhere on the page to be worth highlighting — degrading to "just the
// page, no highlight" is the safer outcome for a short field value (e.g. a
// bare currency code) than risking a spurious highlight.
const MIN_MATCH_LENGTH = 12;

// Returns the item-local highlight ranges for the first occurrence of
// `quote` within the page's text items, or an empty array if no confident
// match is found.
export function findHighlightRanges(items: HighlightTextItem[], quote: string | null | undefined): HighlightRange[] {
  if (!quote || items.length === 0) return [];

  const { joined, spans } = joinItems(items);
  const { collapsed: collapsedJoined, originalIndex } = collapseWithMapping(joined);
  const { collapsed: collapsedQuote } = collapseWithMapping(quote.trim());
  if (collapsedQuote.length < MIN_MATCH_LENGTH) return [];

  const matchStart = collapsedJoined.indexOf(collapsedQuote);
  if (matchStart === -1) return [];

  const originalStart = originalIndex[matchStart];
  const originalEnd = originalIndex[matchStart + collapsedQuote.length - 1] + 1;

  const ranges: HighlightRange[] = [];
  for (let i = 0; i < spans.length; i++) {
    const overlapStart = Math.max(spans[i].start, originalStart);
    const overlapEnd = Math.min(spans[i].end, originalEnd);
    if (overlapStart < overlapEnd) {
      ranges.push({ itemIndex: i, start: overlapStart - spans[i].start, end: overlapEnd - spans[i].start });
    }
  }
  return ranges;
}

// react-pdf's customTextRenderer inserts its return value as innerHTML (see
// PdfViewer.tsx) — every character of real page text has to go through this
// before being wrapped in <mark>, or contract text containing "&"/"<" (e.g.
// "Sections 4 & 5") could corrupt the rendered text layer.
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
