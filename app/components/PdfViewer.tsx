"use client";

import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import Spinner from "./Spinner";
import { escapeHtml, findHighlightRanges, type HighlightTextItem } from "@/lib/pdfHighlight";

// pdf.js's getTextContent() returns a mix of TextItem (has .str) and
// TextMarkedContent (doesn't) — the same check react-pdf's own TextLayer
// uses internally to tell them apart.
function isTextItem(item: TextItem | { type: string }): item is TextItem {
  return "str" in item;
}

// Must be configured in the same module that renders <Document>/<Page> —
// see react-pdf's Next.js setup notes (setting it elsewhere can be overwritten
// by module execution order). This component is loaded client-only via
// next/dynamic({ ssr: false }) from page.tsx, so import.meta.url resolves correctly.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const VIEWER_WIDTH = 680;

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function PageSkeleton() {
  return (
    <div
      className="animate-pulse rounded-[3px] bg-surface-raised"
      style={{ width: VIEWER_WIDTH, maxWidth: "100%", aspectRatio: "8.5 / 11" }}
    />
  );
}

export default function PdfViewer({
  file,
  page,
  section,
  quote,
  onClose,
}: {
  file: File;
  page: number;
  section?: string | null;
  // The exact clause text this citation points to — when it can be located
  // on the page (see lib/pdfHighlight.ts), it's highlighted the same way a
  // browser's own "find in page" would, not just navigated to. Optional and
  // fails silently: a citation with no quote, or one that can't be matched,
  // still opens the right page, just without a highlight.
  quote?: string | null;
  onClose: () => void;
}) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(page);
  const [loadError, setLoadError] = useState("");
  // Tagged with the page it was captured for (set inside onGetTextSuccess's
  // own closure over `currentPage` at the moment that specific page's text
  // resolved — react-pdf cancels a stale in-flight request when the user
  // navigates again before it resolves, so this is never a leftover from an
  // abandoned page load). Deriving staleness this way, instead of an effect
  // that resets state on every page change, avoids a synchronous setState
  // in an effect body for what's really just derived state.
  const [textItems, setTextItems] = useState<{ forPage: number; items: HighlightTextItem[] } | null>(null);

  // Gated on currentPage === page (the page this citation actually points
  // to) — a citation's highlight should never show up on a page the visitor
  // navigated to themselves via Prev/Next — and on textItems.forPage
  // matching the page actually on screen right now.
  const highlightRanges = useMemo(() => {
    if (currentPage !== page || !textItems || textItems.forPage !== currentPage) {
      return new Map<number, { start: number; end: number }>();
    }
    const ranges = findHighlightRanges(textItems.items, quote);
    return new Map(ranges.map((r) => [r.itemIndex, { start: r.start, end: r.end }]));
  }, [textItems, currentPage, page, quote]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setCurrentPage((p) => (numPages ? Math.min(p + 1, numPages) : p));
      else if (e.key === "ArrowLeft") setCurrentPage((p) => Math.max(p - 1, 1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [numPages, onClose]);

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Source PDF viewer"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-md border border-hairline bg-surface shadow-panel"
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {file.name}
              {section ? ` · ${section}` : ""}
            </p>
            <p className="text-xs text-muted">
              Page {currentPage}
              {numPages ? ` of ${numPages}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage <= 1}
              className="flex items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <ChevronLeftIcon />
              Prev
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => (numPages ? Math.min(p + 1, numPages) : p))}
              disabled={numPages !== null && currentPage >= numPages}
              className="flex items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Next
              <ChevronRightIcon />
            </button>
            <span className="mx-0.5 h-4 w-px bg-hairline" />
            <kbd className="rounded border border-hairline-strong px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors duration-200 hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <XIcon />
            </button>
          </div>
        </div>

        <div className="h-0.5 bg-hairline">
          <div
            className="h-full bg-accent transition-[width] duration-200"
            style={{ width: numPages ? `${(currentPage / numPages) * 100}%` : "0%" }}
          />
        </div>

        <div className="flex-1 overflow-auto bg-background/50 bg-[radial-gradient(ellipse_60%_55%_at_50%_45%,rgba(91,121,255,0.10),transparent_70%)] px-4 py-8">
          {loadError ? (
            <p className="py-10 text-center text-sm font-medium text-severity-high">{loadError}</p>
          ) : (
            <div className="mx-auto flex justify-center">
              <Document
                file={file}
                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                onLoadError={() => setLoadError("Couldn't load the PDF for preview.")}
                loading={
                  <div className="flex items-center gap-2 py-10 text-sm text-muted">
                    <Spinner />
                    Loading PDF…
                  </div>
                }
              >
                <div className="rounded-[3px] bg-[#f7f6f2] p-2 shadow-panel">
                  <Page
                    pageNumber={currentPage}
                    width={VIEWER_WIDTH}
                    renderTextLayer
                    renderAnnotationLayer={false}
                    loading={<PageSkeleton />}
                    onGetTextSuccess={(textContent) => {
                      setTextItems({
                        forPage: currentPage,
                        items: textContent.items.filter(isTextItem).map((item) => ({ str: item.str, hasEOL: item.hasEOL })),
                      });
                    }}
                    customTextRenderer={({ itemIndex, str }) => {
                      const range = highlightRanges.get(itemIndex);
                      if (!range) return escapeHtml(str);
                      const before = escapeHtml(str.slice(0, range.start));
                      const match = escapeHtml(str.slice(range.start, range.end));
                      const after = escapeHtml(str.slice(range.end));
                      return `${before}<mark class="ci-cite-highlight">${match}</mark>${after}`;
                    }}
                  />
                </div>
              </Document>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
