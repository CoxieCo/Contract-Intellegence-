"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ChangeEvent, DragEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import {
  CURRENT_ANALYSIS_STORAGE_KEY,
  VIEW_REQUEST_STORAGE_KEY,
  STREAM_CONTRACT_TEXT_DELIMITER,
  severityStyles,
  severityCardStyle,
  severityDotClass,
  zoneTone,
} from "@/lib/contract-analysis";
import Spinner from "./components/Spinner";
import CiteChip from "./components/CiteChip";
import ContractSummaryPrint from "./components/ContractSummaryPrint";
import Landing from "./components/landing/Landing";

// react-pdf depends on browser-only APIs (Canvas, DOMMatrix, the PDF.js worker) and
// must never be evaluated during SSR — see react-pdf's Next.js App Router setup notes.
const PdfViewer = dynamic(() => import("./components/PdfViewer"), { ssr: false });

// ---------- Types (matches the route.ts schema) ----------

interface SourcedValue {
  value: string;
  page: number | null;
  section: string | null;
}

interface ContractOverview {
  contractName: SourcedValue;
  contractType: SourcedValue;
  parties: SourcedValue;
  status: SourcedValue;
  purpose: SourcedValue;
}

interface ImportantDates {
  startDate: SourcedValue;
  endDate: SourcedValue;
  renewalDate: SourcedValue;
  noticePeriod: SourcedValue;
  noticeDeadline: SourcedValue;
  autoRenewal: SourcedValue;
}

interface CommercialTerms {
  contractValue: SourcedValue;
  currency: SourcedValue;
  paymentTerms: SourcedValue;
  paymentFrequency: SourcedValue;
  pricing: SourcedValue;
  priceEscalation: SourcedValue;
  minimumCommitments: SourcedValue;
  latePaymentTerms: SourcedValue;
}

interface KeyClauses {
  termination: SourcedValue;
  earlyTermination: SourcedValue;
  liability: SourcedValue;
  liabilityCap: SourcedValue;
  governingLaw: SourcedValue;
  assignment: SourcedValue;
  changeOfControl: SourcedValue;
  ndaConfidentiality: SourcedValue;
  dataComplianceObligations: SourcedValue;
  slaCommitments: SourcedValue;
}

interface ThingToWatch {
  title: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
  page: number | null;
  section: string | null;
}

interface ContractAnalysis {
  contractOverview?: ContractOverview;
  importantDates?: ImportantDates;
  commercialTerms?: CommercialTerms;
  keyClauses?: KeyClauses;
  thingsToWatch?: ThingToWatch[];
}

type AppState = "idle" | "fileSelected" | "analyzing" | "results";
type TabKey = "overview" | "dates" | "terms" | "clauses" | "watch";
type ViewMode = "quickScan" | "fullReview";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

// ---------- Field label maps ----------

const overviewLabels: Record<keyof ContractOverview, string> = {
  contractName: "Contract name",
  contractType: "Contract type",
  parties: "Parties",
  status: "Status",
  purpose: "Purpose",
};

const datesLabels: Record<keyof ImportantDates, string> = {
  startDate: "Start date",
  endDate: "End date",
  renewalDate: "Renewal date",
  noticePeriod: "Notice period",
  noticeDeadline: "Notice deadline",
  autoRenewal: "Auto-renewal",
};

const termsLabels: Record<keyof CommercialTerms, string> = {
  contractValue: "Contract value",
  currency: "Currency",
  paymentTerms: "Payment terms",
  paymentFrequency: "Payment frequency",
  pricing: "Pricing",
  priceEscalation: "Price escalation",
  minimumCommitments: "Minimum commitments",
  latePaymentTerms: "Late-payment terms",
};

const clausesLabels: Record<keyof KeyClauses, string> = {
  termination: "Termination",
  earlyTermination: "Early termination",
  liability: "Liability",
  liabilityCap: "Liability cap",
  governingLaw: "Governing law",
  assignment: "Assignment",
  changeOfControl: "Change of control",
  ndaConfidentiality: "NDA / confidentiality",
  dataComplianceObligations: "Data / compliance obligations",
  slaCommitments: "SLA commitments",
};

const MODE_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: "quickScan", label: "Quick Scan" },
  { key: "fullReview", label: "Full Review" },
];

const severityRank: Record<ThingToWatch["severity"], number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

const PALETTE_SUGGESTIONS = [
  "Show termination clause",
  "Show all dates",
  "Show high-severity items",
];

// ---------- Helpers ----------

// Purely cosmetic reframing of an already-extracted field — no new data, just
// a small "Vendor contract" tag when the AI's own contractType classification
// reads as a SaaS/software agreement, for IT/vendor-management readers scanning
// a mixed batch of contracts.
const VENDOR_CONTRACT_TYPE_PATTERN = /saas|software|subscription|vendor/i;

function isVendorContractType(contractType: string): boolean {
  return VENDOR_CONTRACT_TYPE_PATTERN.test(contractType);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function parseAnalysis(text: string): { data: ContractAnalysis | null; raw: string } {
  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```[a-zA-Z]*\n/, "")
      .replace(/```$/, "")
      .trim();
  }

  try {
    const parsed = JSON.parse(cleaned) as ContractAnalysis;
    return { data: parsed, raw: text };
  } catch {
    return { data: null, raw: text };
  }
}

function skipWhitespace(text: string, index: number): number {
  let i = index;
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
}

// Scans forward from `start` (the first character of a JSON value) tracking
// brace/bracket depth and string state, returning the index just past the
// value's matching close once it has fully streamed in — or null if it
// hasn't yet. Used only to decide which top-level analysis sections are
// safe to reveal progressively; the final result is always re-validated
// with a strict JSON.parse (parseAnalysis, above) once the stream completes.
function findBalancedValueEnd(text: string, start: number): number | null {
  const opener = text[start];
  if (opener !== "{" && opener !== "[") return null;
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return null;
}

const PARTIAL_ANALYSIS_KEYS: (keyof ContractAnalysis)[] = [
  "contractOverview",
  "importantDates",
  "commercialTerms",
  "keyClauses",
  "thingsToWatch",
];

// Best-effort read of whichever top-level analysis sections have fully
// streamed in so far, so the UI can reveal each Full Review zone as soon as
// its data is available instead of waiting for the entire response. Only a
// section whose value is a syntactically complete, balanced JSON value gets
// parsed and returned — anything still mid-stream is left out entirely
// rather than guessed at.
function parsePartialAnalysis(text: string): Partial<ContractAnalysis> {
  const partial: Partial<ContractAnalysis> = {};
  for (const key of PARTIAL_ANALYSIS_KEYS) {
    const markerIndex = text.indexOf(`"${key}"`);
    if (markerIndex === -1) continue;
    const colonIndex = text.indexOf(":", markerIndex);
    if (colonIndex === -1) continue;
    const valueStart = skipWhitespace(text, colonIndex + 1);
    const valueEnd = findBalancedValueEnd(text, valueStart);
    if (valueEnd === null) continue;
    try {
      partial[key] = JSON.parse(text.slice(valueStart, valueEnd));
    } catch {
      // Malformed despite looking balanced — leave this section out rather
      // than show something wrong; the final strict parse will catch it.
    }
  }
  return partial;
}

// ---------- Command palette search ----------

interface SearchItem {
  tab: TabKey;
  key: string;
  label: string;
  watchIndex?: number;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildSearchIndex(analysis: ContractAnalysis): SearchItem[] {
  const items: SearchItem[] = [];

  if (analysis.contractOverview) {
    (Object.keys(overviewLabels) as (keyof ContractOverview)[]).forEach((key) =>
      items.push({ tab: "overview", key, label: overviewLabels[key] })
    );
  }
  if (analysis.importantDates) {
    (Object.keys(datesLabels) as (keyof ImportantDates)[]).forEach((key) =>
      items.push({ tab: "dates", key, label: datesLabels[key] })
    );
  }
  if (analysis.commercialTerms) {
    (Object.keys(termsLabels) as (keyof CommercialTerms)[]).forEach((key) =>
      items.push({ tab: "terms", key, label: termsLabels[key] })
    );
  }
  if (analysis.keyClauses) {
    (Object.keys(clausesLabels) as (keyof KeyClauses)[]).forEach((key) =>
      items.push({ tab: "clauses", key, label: clausesLabels[key] })
    );
  }
  analysis.thingsToWatch?.forEach((w, i) => {
    items.push({ tab: "watch", key: `watch-${i}`, label: w.title, watchIndex: i });
  });

  return items;
}

function findBestMatch(rawQuery: string, items: SearchItem[]): SearchItem | null {
  const query = normalize(rawQuery);
  if (!query) return null;

  let best: SearchItem | null = null;
  let bestScore = 0;
  let bestLabelLen = 0;

  for (const item of items) {
    const label = normalize(item.label);
    let score = 0;

    if (label === query) score = 100;
    else if (label.length >= 3 && query.includes(label)) score = 80;
    else if (query.length >= 3 && label.includes(query)) score = 60;
    else {
      // Require at least two shared distinctive words — a single overlapping
      // word (e.g. "price" inside a long free-form question) is too weak a
      // signal and should fall through to the AI instead of a wrong field jump.
      const queryWords = query.split(" ").filter((w) => w.length > 2);
      const labelWords = label.split(" ").filter((w) => w.length > 2);
      const common = queryWords.filter((w) => labelWords.includes(w));
      if (common.length >= 2) score = common.length * 20;
    }

    const better =
      score > bestScore || (score === bestScore && score > 0 && label.length > bestLabelLen);

    if (better) {
      bestScore = score;
      bestLabelLen = label.length;
      best = item;
    }
  }

  return bestScore >= 20 ? best : null;
}

// ---------- Icons ----------

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

// ---------- Presentational pieces ----------

// Clause values can run to multi-sentence prose (termination conditions,
// liability language). Below this length they render in full as before;
// above it, they collapse to a preview with the same expand interaction
// used for Things to Watch.
const CLAUSE_PREVIEW_LENGTH = 115;

function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const clipped = text.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(" ");
  return (lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd();
}

function FieldRow({
  label,
  field,
  mono,
  primary,
  expandable,
  highlighted,
  forwardedRef,
  onOpenCitation,
}: {
  label: string;
  field: SourcedValue;
  mono?: boolean;
  primary?: boolean;
  expandable?: boolean;
  highlighted?: boolean;
  forwardedRef?: (el: HTMLDivElement | null) => void;
  onOpenCitation?: (page: number, section: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const notFound = field.value === "Not found";
  const isLong = Boolean(expandable) && !notFound && field.value.length > CLAUSE_PREVIEW_LENGTH;
  const preview = isLong ? truncateAtWord(field.value, CLAUSE_PREVIEW_LENGTH) : field.value;
  const remainder = isLong ? field.value.slice(preview.length) : "";

  return (
    <div
      ref={forwardedRef}
      className={`flex flex-col gap-1 rounded-md border-b border-hairline py-2.5 first:pt-0 last:border-0 last:pb-0 transition-colors duration-300 sm:flex-row sm:items-start sm:justify-between sm:gap-6 ${
        highlighted ? "border-transparent bg-accent/10 px-2 ring-1 ring-accent" : ""
      }`}
    >
      <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted sm:w-48 sm:shrink-0">
        {label}
      </span>
      <span className="flex flex-1 flex-col items-end gap-1">
        <span className="flex w-full items-start justify-end gap-2">
          <span
            className={`tabular-nums sm:text-right ${mono ? "font-mono" : ""} ${
              primary && !notFound ? "text-[18px] leading-6 font-semibold tracking-[-0.01em]" : "text-sm leading-5"
            } ${notFound ? "italic text-muted" : "text-foreground"}`}
          >
            {preview}
            {isLong && !expanded ? "…" : ""}
          </span>
          <CiteChip page={field.page} section={field.section} arrow onOpen={onOpenCitation} />
        </span>
        {isLong && (
          <div className={`accordion-panel w-full ${expanded ? "is-open" : ""}`}>
            <div>
              <p
                className={`pt-0.5 text-sm leading-5 text-foreground sm:text-right ${mono ? "font-mono" : ""}`}
              >
                {remainder}
              </p>
            </div>
          </div>
        )}
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 text-xs font-medium text-accent transition-colors duration-200 hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronIcon open={expanded} />
            {expanded ? "Show less" : "Read more"}
          </button>
        )}
      </span>
    </div>
  );
}

// Zone 2/3 card — micro-label + citation badge up top, the value reads as
// the dominant "primary" text underneath (numbers people scan for first).
// Real contracts often put compound/conditional language in these fields
// too (a percentage escalation clause, a multi-part renewal term), not just
// a plain date or dollar figure — so it reuses the same truncate-then-expand
// interaction as Key Clauses' ClauseCard (same CLAUSE_PREVIEW_LENGTH cutoff,
// same accordion-panel reveal, same "Read more" affordance) instead of
// letting a long value either overflow the card or invent a second pattern.
function FieldCard({
  label,
  field,
  mono,
  primary,
  highlighted,
  forwardedRef,
  onOpenCitation,
}: {
  label: string;
  field: SourcedValue;
  mono?: boolean;
  primary?: boolean;
  highlighted?: boolean;
  forwardedRef?: (el: HTMLDivElement | null) => void;
  onOpenCitation?: (page: number, section: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const notFound = field.value === "Not found";
  const isLong = !notFound && field.value.length > CLAUSE_PREVIEW_LENGTH;
  const preview = isLong ? truncateAtWord(field.value, CLAUSE_PREVIEW_LENGTH) : field.value;
  const remainder = isLong ? field.value.slice(preview.length) : "";
  const valueTextClass = `tabular-nums ${mono ? "font-mono" : ""} ${
    notFound
      ? "text-sm italic text-muted"
      : primary
        ? "text-[20px] leading-6 font-semibold tracking-[-0.01em] text-foreground"
        : "text-base font-semibold text-foreground"
  }`;

  return (
    <div
      ref={forwardedRef}
      className={`rounded-md border p-3 transition-colors duration-300 ${
        highlighted ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-hairline bg-background/40"
      }`}
    >
      {/* flex-wrap: a long citation (real contracts can carry several
          item/clause numbers) shouldn't be forced onto the same line as the
          label in cards this narrow — it drops to its own line instead of
          overlapping the label, the same failure mode the old Important
          Dates timeline had. */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">{label}</span>
        <CiteChip page={field.page} section={field.section} onOpen={onOpenCitation} />
      </div>
      <p className={`mt-2 ${valueTextClass}`}>
        {preview}
        {isLong && !expanded ? "…" : ""}
      </p>
      {isLong && (
        <div className={`accordion-panel ${expanded ? "is-open" : ""}`}>
          <div>
            <p className={`pt-0.5 ${valueTextClass}`}>{remainder}</p>
          </div>
        </div>
      )}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1.5 flex items-center gap-1 text-xs font-medium text-accent transition-colors duration-200 hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ChevronIcon open={expanded} />
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

// Zone 4 card — clause text reads as an annotation (bold title + prose),
// not extracted data, so it keeps the truncate/expand behavior built for
// long clause text instead of FieldCard's big-number treatment.
function ClauseCard({
  label,
  field,
  highlighted,
  forwardedRef,
  onOpenCitation,
}: {
  label: string;
  field: SourcedValue;
  highlighted?: boolean;
  forwardedRef?: (el: HTMLDivElement | null) => void;
  onOpenCitation?: (page: number, section: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const notFound = field.value === "Not found";
  const isLong = !notFound && field.value.length > CLAUSE_PREVIEW_LENGTH;
  const preview = isLong ? truncateAtWord(field.value, CLAUSE_PREVIEW_LENGTH) : field.value;
  const remainder = isLong ? field.value.slice(preview.length) : "";

  return (
    <div
      ref={forwardedRef}
      className={`rounded-md border p-3 transition-colors duration-300 ${
        highlighted ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-hairline bg-background/40"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <CiteChip page={field.page} section={field.section} onOpen={onOpenCitation} />
      </div>
      <p className={`mt-1.5 text-sm leading-5 ${notFound ? "italic text-muted" : "text-muted"}`}>
        {preview}
        {isLong && !expanded ? "…" : ""}
      </p>
      {isLong && (
        <div className={`accordion-panel ${expanded ? "is-open" : ""}`}>
          <div>
            <p className="pt-0.5 text-sm leading-5 text-muted">{remainder}</p>
          </div>
        </div>
      )}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 flex items-center gap-1 text-xs font-medium text-accent transition-colors duration-200 hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ChevronIcon open={expanded} />
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

// Zone 1's identity fields are bespoke layout (heading/subtitle/badge), not
// generic label-value rows, but still need the same scroll-to-and-flash
// highlight the palette already uses everywhere else. Branches on a static
// tag per case (rather than a dynamic `<Tag>`) so each ref attaches to a
// literal host element — the pattern the ref-safety lint rule expects.
function HighlightField({
  as,
  active,
  className,
  forwardedRef,
  children,
}: {
  as: "h2" | "p" | "span";
  active?: boolean;
  className?: string;
  forwardedRef?: (el: HTMLElement | null) => void;
  children: ReactNode;
}) {
  const fullClassName = `transition-colors duration-300 ${className ?? ""} ${
    active ? "-mx-1 rounded-md bg-accent/10 px-1 ring-1 ring-accent" : ""
  }`;

  if (as === "h2") {
    return (
      <h2 ref={forwardedRef} className={fullClassName}>
        {children}
      </h2>
    );
  }
  if (as === "p") {
    return (
      <p ref={forwardedRef} className={fullClassName}>
        {children}
      </p>
    );
  }
  return (
    <span ref={forwardedRef} className={fullClassName}>
      {children}
    </span>
  );
}

function WatchAccordionItem({
  item,
  open,
  onToggle,
  onWhyRisky,
  highlighted,
  forwardedRef,
  onOpenCitation,
  arrow,
}: {
  item: ThingToWatch;
  open: boolean;
  onToggle: () => void;
  onWhyRisky: () => void;
  highlighted?: boolean;
  forwardedRef?: (el: HTMLDivElement | null) => void;
  onOpenCitation?: (page: number, section: string | null) => void;
  // Quick Scan's "Top risk" instance passes this; Full Review's Zone 5 list
  // doesn't — see the same note on CiteChip's `arrow` prop.
  arrow?: boolean;
}) {
  return (
    <div
      ref={forwardedRef}
      className={`rounded-md border px-3 transition-colors duration-300 ${
        highlighted ? "border-transparent bg-accent/10 ring-1 ring-accent" : severityCardStyle(item.severity)
      }`}
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2.5 text-left text-muted transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ChevronIcon open={open} />
          <span className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-medium tracking-[0.04em] ${severityStyles(item.severity)}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${severityDotClass(item.severity)}`} />
            {item.severity}
          </span>
          <span className="text-sm font-medium text-foreground">{item.title}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onWhyRisky();
            }}
            className="whitespace-nowrap rounded border border-hairline bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted transition-colors duration-200 hover:border-hairline-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Why is this risky?
          </button>
          <CiteChip page={item.page} section={item.section} arrow={arrow} onOpen={onOpenCitation} />
        </div>
      </div>
      <div className={`accordion-panel ${open ? "is-open" : ""}`}>
        <div>
          <p className="pb-3 pl-7 text-sm leading-5 text-muted">{item.explanation}</p>
        </div>
      </div>
    </div>
  );
}

// ---------- Main page ----------

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const fieldRefs = useRef<Map<string, HTMLElement>>(new Map());
  const watchRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const [appState, setAppState] = useState<AppState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [rawAnalysis, setRawAnalysis] = useState("");
  const [contractText, setContractText] = useState("");
  const [copied, setCopied] = useState(false);

  // Set only when the results view was restored from the dashboard (a past
  // analysis, or the current one revisited) rather than a live upload — there
  // is no File object in that case, so this is what the header/citations fall
  // back to for a display name.
  const [archivedFileName, setArchivedFileName] = useState<string | null>(null);

  // Stamped whenever a results view is entered (fresh analysis or a past one
  // restored from the dashboard) — the print summary's footer date. Not a
  // stored analysis timestamp (past analyses' original date isn't part of
  // the dashboard handoff payload), so a revisited analysis prints today's
  // date rather than the date it originally ran.
  const [analyzedAt, setAnalyzedAt] = useState<Date | null>(null);

  // The conversation log lives here regardless of entry point (Cmd+K or the
  // "Ask AI" button) — both open the same docked palette/panel.
  const [askHistory, setAskHistory] = useState<{ question: string; answer: string; sourceHint?: string }[]>([]);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState("");

  const [openWatchItems, setOpenWatchItems] = useState<Set<number>>(new Set([0]));

  const [viewMode, setViewMode] = useState<ViewMode>("quickScan");
  const [watchSortHighFirst, setWatchSortHighFirst] = useState(true);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteRendered, setPaletteRendered] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");

  const [highlight, setHighlight] = useState<{ tab: TabKey; key: string } | null>(null);
  const [highlightWatchIndex, setHighlightWatchIndex] = useState<number | null>(null);

  const [viewerCitation, setViewerCitation] = useState<{ page: number; section: string | null } | null>(null);

  const openCitation = (page: number, section: string | null) => {
    setViewerCitation({ page, section });
  };

  const scrollToUpload = () => {
    uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleWatchItem = (index: number) => {
    setOpenWatchItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleWhyRisky = (index: number) => {
    setOpenWatchItems((prev) => new Set(prev).add(index));
    setHighlightWatchIndex(index);
  };

  const registerFieldRef = (tab: TabKey, key: string) => (el: HTMLElement | null) => {
    const mapKey = `${tab}-${key}`;
    if (el) fieldRefs.current.set(mapKey, el);
    else fieldRefs.current.delete(mapKey);
  };

  const registerWatchRef = (index: number) => (el: HTMLDivElement | null) => {
    if (el) watchRefs.current.set(index, el);
    else watchRefs.current.delete(index);
  };

  // ----- Restore a past analysis requested from the dashboard -----
  // Navigating "/dashboard" -> "/" unmounts this component, so a fresh
  // analysis and a past one clicked from the dashboard both need this same
  // mount-time hydration to land in the identical results view.

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(VIEW_REQUEST_STORAGE_KEY);
      if (raw) sessionStorage.removeItem(VIEW_REQUEST_STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;

    let request: { fileName: string; analysis: ContractAnalysis } | null = null;
    try {
      const parsed = JSON.parse(raw) as { fileName: string; analysis: ContractAnalysis };
      if (parsed?.analysis) request = parsed;
    } catch {
      // Malformed handoff payload — fall through to the normal idle screen.
    }
    if (!request) return;

    // Deferred to a microtask rather than called directly in the effect body —
    // this is a one-time hydration from external (browser) storage on mount,
    // not state derived from props/state React already knows about.
    const hydrate = request;
    queueMicrotask(() => {
      setAnalysis(hydrate.analysis);
      setRawAnalysis(JSON.stringify(hydrate.analysis, null, 2));
      setArchivedFileName(hydrate.fileName);
      setContractText("");

      const topHighIndex = hydrate.analysis.thingsToWatch?.findIndex((w) => w.severity === "HIGH") ?? -1;
      setOpenWatchItems(new Set([topHighIndex >= 0 ? topHighIndex : 0]));

      setViewMode("quickScan");
      setWatchSortHighFirst(true);
      setAnalyzedAt(new Date());
      setAppState("results");

      try {
        sessionStorage.setItem(CURRENT_ANALYSIS_STORAGE_KEY, JSON.stringify({ fileName: hydrate.fileName, analysis: hydrate.analysis }));
      } catch {
        // Non-critical — only affects whether the dashboard's "currently open" card picks this up.
      }
    });
  }, []);

  // ----- Global keyboard shortcut (Cmd+K / Ctrl+K, Escape) -----

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteQuery("");
        setPaletteOpen(true);
        setPaletteRendered(true);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!paletteOpen) return;
    const id = requestAnimationFrame(() => paletteInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [paletteOpen]);

  // Keep the palette mounted for the exit animation (150ms) instead of
  // unmounting the instant it closes. Opening sets paletteRendered(true)
  // directly at each call site so this effect only ever needs to handle
  // the delayed close.
  useEffect(() => {
    if (paletteOpen) return;
    const timeout = setTimeout(() => setPaletteRendered(false), 150);
    return () => clearTimeout(timeout);
  }, [paletteOpen]);

  // ----- Highlight scroll + fade -----

  useEffect(() => {
    if (!highlight) return;
    const el = fieldRefs.current.get(`${highlight.tab}-${highlight.key}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = setTimeout(() => setHighlight(null), 2200);
    return () => clearTimeout(timeout);
  }, [highlight]);

  useEffect(() => {
    if (highlightWatchIndex === null) return;
    const el = watchRefs.current.get(highlightWatchIndex);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = setTimeout(() => setHighlightWatchIndex(null), 2200);
    return () => clearTimeout(timeout);
  }, [highlightWatchIndex]);

  // ----- Command palette -----

  // All 5 zones are always mounted in Full Review now, so "jumping" no
  // longer means switching tabs — just leaving Quick Scan (if active) and
  // scrolling/highlighting the target field, which was already how the
  // highlight-and-scroll effect below worked.
  const jumpToField = (
    tab: TabKey,
    opts?: { highlightKey?: string; watchIndex?: number; sortWatchHighFirst?: boolean }
  ) => {
    setViewMode("fullReview");
    setHighlight(opts?.highlightKey ? { tab, key: opts.highlightKey } : null);
    setHighlightWatchIndex(opts?.watchIndex ?? null);
    if (opts?.watchIndex !== undefined) {
      setOpenWatchItems((prev) => new Set(prev).add(opts.watchIndex!));
    }
    if (opts?.sortWatchHighFirst) setWatchSortHighFirst(true);
    setPaletteOpen(false);
    setPaletteQuery("");
  };

  // Shared by both the palette's free-text fallback and any other entry
  // point into the ask panel — there's only one conversation now.
  const askContract = async (question: string) => {
    const q = question.trim();
    if (!q || !contractText || askLoading) return;

    setAskLoading(true);
    setAskError("");
    setPaletteQuery("");

    // Last few turns only — enough to resolve "what about the other party?"
    // without letting the request grow unbounded as the log gets long.
    const history = askHistory.slice(-3).map(({ question, answer }) => ({ question, answer }));

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractText, question: q, history }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAskError(data.error || "Couldn't get an answer. Try again.");
        return;
      }

      setAskHistory((prev) => [...prev, { question: q, answer: data.answer, sourceHint: data.sourceHint }]);
    } catch {
      setAskError("Couldn't reach the AI. Is the dev server running?");
    } finally {
      setAskLoading(false);
    }
  };

  // Same lookup runPaletteQuery uses at submit time, run on every keystroke so
  // the palette can show what Enter will do before it's pressed.
  const paletteMatch =
    analysis && paletteQuery.trim() ? findBestMatch(paletteQuery, buildSearchIndex(analysis)) : null;

  const runPaletteQuery = (rawQuery: string) => {
    setPaletteQuery(rawQuery);
    const query = normalize(rawQuery);
    if (!analysis || !query) return;

    const match = findBestMatch(rawQuery, buildSearchIndex(analysis));
    if (match) {
      jumpToField(match.tab, {
        highlightKey: match.watchIndex === undefined ? match.key : undefined,
        watchIndex: match.watchIndex,
      });
      return;
    }

    if (query.includes("severity") || query.includes("risky") || query.includes("risk")) {
      jumpToField("watch", { sortWatchHighFirst: true });
      return;
    }
    if (query.includes("date")) {
      jumpToField("dates");
      return;
    }
    if (query.includes("overview")) {
      jumpToField("overview");
      return;
    }
    if (
      query.includes("terms") ||
      query.includes("commercial") ||
      query.includes("payment") ||
      query.includes("pricing")
    ) {
      jumpToField("terms");
      return;
    }
    if (query.includes("clause")) {
      jumpToField("clauses");
      return;
    }
    if (query.includes("watch")) {
      jumpToField("watch");
      return;
    }

    void askContract(rawQuery);
  };

  const handlePaletteKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") runPaletteQuery(paletteQuery);
  };

  // ----- File selection -----

  const handleFile = (file: File) => {
    setError("");
    setAnalysis(null);
    setRawAnalysis("");

    if (file.type !== "application/pdf") {
      setSelectedFile(null);
      setAppState("idle");
      setError("Please select a PDF file.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setAppState("idle");
      setError("That PDF is larger than 15MB. Try a smaller file.");
      return;
    }

    setSelectedFile(file);
    setAppState("fileSelected");
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const removeFile = () => {
    setSelectedFile(null);
    setError("");
    setAnalysis(null);
    setRawAnalysis("");
    setContractText("");
    setAppState("idle");
    setViewMode("quickScan");
    setWatchSortHighFirst(true);
    setHighlight(null);
    setHighlightWatchIndex(null);
    setViewerCitation(null);
    setAskHistory([]);
    setAskError("");
    sessionStorage.removeItem(CURRENT_ANALYSIS_STORAGE_KEY);
    setArchivedFileName(null);
    setAnalyzedAt(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ----- Analysis -----

  const handleContinue = async () => {
    if (!selectedFile) return;

    setAppState("analyzing");
    setError("");
    setAnalysis(null);
    setRawAnalysis("");
    setContractText("");

    // True once any section has landed and the view has switched from the
    // "analyzing" spinner to the results panel — guards the one-time
    // results-entry setup below from running more than once, and covers the
    // (rare) case of a response that streamed in too fast to ever show a
    // partial state, so that setup still runs once at the end.
    let enteredResults = false;
    const seenKeys = new Set<keyof ContractAnalysis>();

    const enterResultsView = () => {
      if (enteredResults) return;
      enteredResults = true;
      setViewMode("quickScan");
      setWatchSortHighFirst(true);
      setHighlight(null);
      setHighlightWatchIndex(null);
      setViewerCitation(null);
      setAskHistory([]);
      setAskError("");
      setAnalyzedAt(new Date());
      setAppState("results");
    };

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong analyzing the PDF.");
        setAppState("fileSelected");
        return;
      }

      if (!res.body) {
        setError("Couldn't reach the analysis service. Is the dev server running?");
        setAppState("fileSelected");
        return;
      }

      // The response streams the analysis JSON as plain text as Claude
      // generates it (see app/api/analyze/route.ts), so each Full Review /
      // Quick Scan field can appear as soon as its section is complete
      // instead of the whole panel popping in at once at the end.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const delimiterIndex = buffer.indexOf(STREAM_CONTRACT_TEXT_DELIMITER);
        const analysisTextSoFar = delimiterIndex === -1 ? buffer : buffer.slice(0, delimiterIndex);

        const partial = parsePartialAnalysis(analysisTextSoFar);
        const newKeys = (Object.keys(partial) as (keyof ContractAnalysis)[]).filter((k) => !seenKeys.has(k));
        if (newKeys.length === 0) continue;
        newKeys.forEach((k) => seenKeys.add(k));

        setAnalysis((prev) => ({ ...(prev ?? {}), ...partial }));
        enterResultsView();

        if (newKeys.includes("thingsToWatch") && partial.thingsToWatch) {
          const topHighIndex = partial.thingsToWatch.findIndex((w) => w.severity === "HIGH");
          setOpenWatchItems(new Set([topHighIndex >= 0 ? topHighIndex : 0]));
        }
      }
      buffer += decoder.decode();

      const delimiterIndex = buffer.indexOf(STREAM_CONTRACT_TEXT_DELIMITER);
      const analysisText = delimiterIndex === -1 ? buffer : buffer.slice(0, delimiterIndex);
      const finalContractText = delimiterIndex === -1 ? "" : buffer.slice(delimiterIndex + STREAM_CONTRACT_TEXT_DELIMITER.length);

      const { data: parsed, raw } = parseAnalysis(analysisText);

      if (!parsed) {
        setError("The analysis didn't come back in a format we could read. Please try again.");
        setAppState("fileSelected");
        return;
      }

      setAnalysis(parsed);
      setRawAnalysis(raw);
      setContractText(finalContractText);

      try {
        sessionStorage.setItem(
          CURRENT_ANALYSIS_STORAGE_KEY,
          JSON.stringify({ fileName: selectedFile.name, analysis: parsed })
        );
      } catch {
        // Session storage can fail (private browsing, quota) — the dashboard's
        // "currently open" card just won't have anything to show, harmless.
      }

      const topHighIndex = parsed.thingsToWatch?.findIndex((w) => w.severity === "HIGH") ?? -1;
      setOpenWatchItems(new Set([topHighIndex >= 0 ? topHighIndex : 0]));

      enterResultsView();
    } catch {
      setError("Couldn't reach the analysis service. Is the dev server running?");
      setAppState("fileSelected");
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setAnalysis(null);
    setRawAnalysis("");
    setContractText("");
    setError("");
    setAppState("idle");
    setViewMode("quickScan");
    setWatchSortHighFirst(true);
    setHighlight(null);
    setHighlightWatchIndex(null);
    setViewerCitation(null);
    setAskHistory([]);
    setAskError("");
    sessionStorage.removeItem(CURRENT_ANALYSIS_STORAGE_KEY);
    setArchivedFileName(null);
    setAnalyzedAt(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDownload = () => {
    if (!rawAnalysis) return;

    const blob = new Blob([rawAnalysis], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = selectedFile?.name.replace(/\.pdf$/i, "") || "contract";

    a.href = url;
    a.download = `${baseName}-analysis.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!rawAnalysis) return;

    try {
      await navigator.clipboard.writeText(rawAnalysis);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy to clipboard.");
    }
  };

  // No PDF library involved — #print-summary-root (see globals.css's
  // @media print block) is already in the DOM, just hidden on screen, so
  // this only has to trigger the browser's own print dialog. "Save as PDF"
  // is one of its built-in destinations.
  const handleExportPdf = () => {
    window.print();
  };

  const watchCount = analysis?.thingsToWatch?.length ?? 0;
  const highCount = analysis?.thingsToWatch?.filter((w) => w.severity === "HIGH").length ?? 0;
  const mediumCount = analysis?.thingsToWatch?.filter((w) => w.severity === "MEDIUM").length ?? 0;
  const lowCount = analysis?.thingsToWatch?.filter((w) => w.severity === "LOW").length ?? 0;
  const watchTone = zoneTone(analysis?.thingsToWatch ?? []);

  const displayedWatchItems = (analysis?.thingsToWatch ?? []).map((item, i) => ({ item, i }));
  if (watchSortHighFirst) {
    displayedWatchItems.sort((a, b) => severityRank[a.item.severity] - severityRank[b.item.severity]);
  }

  // Quick Scan — highest-priority fields only, "Not found" omitted
  const quickScanFields: { tab: TabKey; key: string; label: string; field: SourcedValue; mono?: boolean }[] = [];
  if (analysis?.importantDates) {
    const d = analysis.importantDates;
    if (d.renewalDate.value !== "Not found")
      quickScanFields.push({ tab: "dates", key: "renewalDate", label: datesLabels.renewalDate, field: d.renewalDate, mono: true });
    if (d.noticePeriod.value !== "Not found")
      quickScanFields.push({ tab: "dates", key: "noticePeriod", label: datesLabels.noticePeriod, field: d.noticePeriod, mono: true });
    if (d.autoRenewal.value !== "Not found")
      quickScanFields.push({ tab: "dates", key: "autoRenewal", label: datesLabels.autoRenewal, field: d.autoRenewal, mono: true });
  }
  if (analysis?.commercialTerms && analysis.commercialTerms.priceEscalation.value !== "Not found") {
    quickScanFields.push({
      tab: "terms",
      key: "priceEscalation",
      label: termsLabels.priceEscalation,
      field: analysis.commercialTerms.priceEscalation,
      mono: true,
    });
  }
  if (analysis?.keyClauses) {
    const c = analysis.keyClauses;
    if (c.termination.value !== "Not found")
      quickScanFields.push({ tab: "clauses", key: "termination", label: clausesLabels.termination, field: c.termination });
    if (c.liabilityCap.value !== "Not found")
      quickScanFields.push({ tab: "clauses", key: "liabilityCap", label: clausesLabels.liabilityCap, field: c.liabilityCap });
  }

  const topHighIndex = analysis?.thingsToWatch?.findIndex((w) => w.severity === "HIGH") ?? -1;
  const topHighItem = topHighIndex >= 0 ? analysis!.thingsToWatch![topHighIndex] : null;

  const isHighlighted = (tab: TabKey, key: string) => highlight?.tab === tab && highlight.key === key;

  // Zone 1's fields are individual JSX (not a .map() over a field list, since
  // each one has distinct typography), so each ref callback is precomputed
  // here via .reduce() into a lookup rather than called inline in the JSX
  // below — inline calls to registerFieldRef() outside of a .map() trip the
  // ref-safety lint rule, even though the callback itself only ever runs
  // outside render, as a genuine ref attach/detach.
  const overviewFieldRefs = (["contractName", "purpose", "status", "contractType", "parties"] as const).reduce(
    (acc, key) => {
      acc[key] = registerFieldRef("overview", key);
      return acc;
    },
    {} as Record<string, (el: HTMLElement | null) => void>
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Pre-scan marketing/landing page — its own light theme, own nav/hero/
          upload/footer. Swapped out entirely once a contract is analyzed. */}
      {appState !== "results" && (
        <Landing
          appState={appState}
          selectedFile={selectedFile}
          isDragging={isDragging}
          error={error}
          fileInputRef={fileInputRef}
          uploadSectionRef={uploadSectionRef}
          onFileInput={handleFileInput}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onRemoveClick={removeFile}
          onContinueClick={handleContinue}
          onScanCta={scrollToUpload}
          formatFileSize={formatFileSize}
        />
      )}

      {/* Results view — unchanged dark theme, own top bar */}
      {appState === "results" && (
      <header className="sticky top-0 z-40 border-b border-hairline bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[11px] font-semibold text-white">
              CI
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Contract Intelligence
            </span>
          </div>
          <div className="hidden items-center gap-7 text-sm text-muted md:flex">
            <Link href="/dashboard" className="transition-colors duration-200 hover:text-foreground">Dashboard</Link>
          </div>
          <button
            type="button"
            className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Sign in
          </button>
        </div>
      </header>
      )}

      {appState === "results" && (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="animate-fade-in mb-6">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Contracts</h1>
          <p className="mt-1 text-sm text-muted">
            Upload a PDF to extract key terms, dates, and provisions worth reviewing.
          </p>
        </div>

        {/* Results — dashboard panel with mode switcher, tabs + accordion */}
        {appState === "results" && (
          <div className="animate-fade-in mx-auto w-full max-w-4xl">
            <div className="rounded-md border border-hairline bg-surface shadow-panel">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
                <div>
                  <h2 className="text-[15px] font-semibold text-foreground">Analysis results</h2>
                  {(selectedFile || archivedFileName) && (
                    <p className="mt-0.5 text-[13px] text-muted">
                      {selectedFile ? selectedFile.name : archivedFileName}
                      {watchCount > 0 && (
                        <span className="ml-2 tabular-nums text-muted">
                          · {watchCount} item{watchCount !== 1 ? "s" : ""} to review
                          {highCount > 0 ? ` (${highCount} high)` : ""}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Export PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors duration-200 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    New analysis
                  </button>
                </div>
              </div>

              {analysis ? (
                <>
                  {/* Mode switcher */}
                  <div className="flex flex-wrap items-center gap-1 border-b border-hairline px-5 py-2.5">
                    {MODE_OPTIONS.map((mode) => {
                      const active = viewMode === mode.key;
                      return (
                        <button
                          key={mode.key}
                          type="button"
                          onClick={() => setViewMode(mode.key)}
                          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                            active
                              ? "bg-accent text-white"
                              : "text-muted hover:bg-surface-raised hover:text-foreground"
                          }`}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>

                  {viewMode === "quickScan" && (
                    <div className="animate-fade-in px-5 py-4">
                      <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted">Key facts</p>
                      <div>
                        {quickScanFields.length > 0 ? (
                          quickScanFields.map((f) => (
                            <FieldRow
                              key={`${f.tab}-${f.key}`}
                              label={f.label}
                              field={f.field}
                              mono={f.mono}
                              onOpenCitation={openCitation}
                            />
                          ))
                        ) : (
                          <p className="py-2.5 text-sm text-muted">No key facts found for this contract.</p>
                        )}
                      </div>

                      {topHighItem && (
                        <div className="mt-5 border-t border-hairline pt-4">
                          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted">Top risk</p>
                          <WatchAccordionItem
                            item={topHighItem}
                            open={openWatchItems.has(topHighIndex)}
                            onToggle={() => toggleWatchItem(topHighIndex)}
                            onWhyRisky={() => handleWhyRisky(topHighIndex)}
                            onOpenCitation={openCitation}
                            arrow
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setViewMode("fullReview")}
                        className="mt-4 text-xs font-medium text-accent transition-colors duration-200 hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        View full analysis →
                      </button>
                    </div>
                  )}

                  {viewMode === "fullReview" && (
                    <div className="animate-fade-in space-y-5 px-5 py-5">
                      {/* Zone 1 — Contract identity */}
                      {analysis.contractOverview && (
                        <section className="rounded-md border border-hairline bg-background/30 p-5">
                          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                            Contract identity
                          </p>
                          <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                              <HighlightField
                                as="h2"
                                className="text-2xl font-semibold tracking-[-0.02em] text-foreground"
                                active={isHighlighted("overview", "contractName")}
                                forwardedRef={overviewFieldRefs.contractName}
                              >
                                {analysis.contractOverview.contractName.value}
                              </HighlightField>
                              {analysis.contractOverview.purpose.value !== "Not found" && (
                                <HighlightField
                                  as="p"
                                  className="mt-1.5 max-w-xl text-sm leading-6 text-muted"
                                  active={isHighlighted("overview", "purpose")}
                                  forwardedRef={overviewFieldRefs.purpose}
                                >
                                  {analysis.contractOverview.purpose.value}
                                </HighlightField>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <HighlightField
                                as="span"
                                className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-surface-raised px-2.5 py-1 text-xs font-medium text-foreground"
                                active={isHighlighted("overview", "status")}
                                forwardedRef={overviewFieldRefs.status}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                                {analysis.contractOverview.status.value}
                              </HighlightField>
                              {analysis.contractOverview.contractType.value !== "Not found" && (
                                <HighlightField
                                  as="p"
                                  className="mt-2 text-xs text-muted"
                                  active={isHighlighted("overview", "contractType")}
                                  forwardedRef={overviewFieldRefs.contractType}
                                >
                                  {analysis.contractOverview.contractType.value}
                                </HighlightField>
                              )}
                              {isVendorContractType(analysis.contractOverview.contractType.value) && (
                                <span className="mt-1.5 inline-block rounded border border-hairline bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">
                                  Vendor contract
                                </span>
                              )}
                              {analysis.contractOverview.parties.value !== "Not found" && (
                                <HighlightField
                                  as="p"
                                  className="mt-0.5 text-sm font-semibold text-foreground"
                                  active={isHighlighted("overview", "parties")}
                                  forwardedRef={overviewFieldRefs.parties}
                                >
                                  {analysis.contractOverview.parties.value}
                                </HighlightField>
                              )}
                            </div>
                          </div>
                        </section>
                      )}

                      {/* Zone 2 — Important dates */}
                      {analysis.importantDates && (
                        <section className="rounded-md border border-hairline bg-background/30 p-5">
                          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                            Important dates
                          </p>
                          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {(Object.keys(datesLabels) as (keyof ImportantDates)[])
                              .filter((key) => analysis.importantDates![key].value !== "Not found")
                              .map((key) => (
                                <FieldCard
                                  key={key}
                                  label={datesLabels[key]}
                                  field={analysis.importantDates![key]}
                                  mono
                                  highlighted={isHighlighted("dates", key)}
                                  forwardedRef={registerFieldRef("dates", key)}
                                  onOpenCitation={openCitation}
                                />
                              ))}
                          </div>
                        </section>
                      )}

                      {/* Zone 3 — Commercial terms */}
                      {analysis.commercialTerms && (
                        <section className="rounded-md border border-hairline bg-background/30 p-5">
                          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                            Commercial terms
                          </p>
                          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {(Object.keys(termsLabels) as (keyof CommercialTerms)[]).map((key) => (
                              <FieldCard
                                key={key}
                                label={termsLabels[key]}
                                field={analysis.commercialTerms![key]}
                                mono
                                primary={key === "contractValue"}
                                highlighted={isHighlighted("terms", key)}
                                forwardedRef={registerFieldRef("terms", key)}
                                onOpenCitation={openCitation}
                              />
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Zone 4 — Key clauses */}
                      {analysis.keyClauses && (
                        <section className="rounded-md border border-hairline bg-background/30 p-5">
                          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                            Key clauses
                          </p>
                          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {(Object.keys(clausesLabels) as (keyof KeyClauses)[]).map((key) => (
                              <ClauseCard
                                key={key}
                                label={clausesLabels[key]}
                                field={analysis.keyClauses![key]}
                                highlighted={isHighlighted("clauses", key)}
                                forwardedRef={registerFieldRef("clauses", key)}
                                onOpenCitation={openCitation}
                              />
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Zone 5 — Things to watch */}
                      <section className={`rounded-md border ${watchTone.border} bg-background/30 p-5`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className={`text-[11px] font-medium uppercase tracking-[0.04em] ${watchTone.label}`}>
                            Things to watch
                          </p>
                          {watchCount > 0 && (
                            <p className="text-xs tabular-nums text-muted">
                              {[
                                highCount > 0 ? `${highCount} high` : null,
                                mediumCount > 0 ? `${mediumCount} medium` : null,
                                lowCount > 0 ? `${lowCount} low` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <div className="mt-4">
                          {watchCount > 0 ? (
                            <div className="space-y-2">
                              {displayedWatchItems.map(({ item, i }) => (
                                <WatchAccordionItem
                                  key={i}
                                  item={item}
                                  open={openWatchItems.has(i)}
                                  onToggle={() => toggleWatchItem(i)}
                                  onWhyRisky={() => handleWhyRisky(i)}
                                  highlighted={highlightWatchIndex === i}
                                  forwardedRef={registerWatchRef(i)}
                                  onOpenCitation={openCitation}
                                />
                              ))}
                            </div>
                          ) : (
                            <p className="py-2.5 text-sm text-muted">No significant risks flagged.</p>
                          )}
                        </div>
                      </section>
                    </div>
                  )}

                </>
              ) : (
                <div className="px-5 py-4">
                  <h3 className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                    Raw response
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap font-mono text-sm leading-5 text-foreground">{rawAnalysis}</p>
                  <p className="mt-3 text-xs text-muted">
                    Couldn&apos;t parse this as structured data, so showing the raw text instead.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      )}

      {appState === "results" && (
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Contract Intelligence</span>
          <span>AI-powered contract analysis</span>
        </div>
      </footer>
      )}

      {/* Persistent AI affordance — quiet, corner-anchored, present on every screen */}
      <button
        type="button"
        onClick={() => {
          setPaletteQuery("");
          setPaletteOpen(true);
          setPaletteRendered(true);
        }}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full border border-hairline bg-surface/90 px-3.5 py-2 text-xs font-medium text-muted shadow-panel backdrop-blur-md transition-colors duration-200 hover:border-hairline-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Ask AI
        <span className="ml-0.5 rounded border border-hairline-strong px-1 py-0.5 text-[10px] leading-none text-muted">⌘K</span>
      </button>

      {/* Command palette */}
      {paletteRendered && (
        <div
          role="presentation"
          onClick={() => setPaletteOpen(false)}
          className={`fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm ${
            paletteOpen ? "animate-backdrop-in" : "animate-backdrop-out"
          }`}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg overflow-hidden rounded-md border border-hairline bg-surface shadow-panel ${
              paletteOpen ? "animate-palette-in" : "animate-palette-out"
            }`}
          >
            <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
              <SearchIcon />
              <input
                ref={paletteInputRef}
                type="text"
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                onKeyDown={handlePaletteKeyDown}
                placeholder={analysis ? 'Search fields, or ask a question…' : "Upload a contract to get started"}
                disabled={!analysis}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none disabled:cursor-not-allowed"
              />
              {analysis && paletteQuery.trim() !== "" && (
                <span
                  className={`shrink-0 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium ${
                    paletteMatch
                      ? "border-accent/40 bg-accent/10 text-[#c9d3ff]"
                      : "border-hairline bg-surface-raised text-muted"
                  }`}
                >
                  {paletteMatch ? `↵ Jump to ${paletteMatch.label}` : "↵ Ask AI"}
                </span>
              )}
              <kbd className="rounded border border-hairline-strong px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
            </div>

            <div className="max-h-96 overflow-y-auto px-2 py-2">
              {!analysis ? (
                <p className="px-2.5 py-3 text-sm text-muted">Upload a contract to get started.</p>
              ) : (
                <>
                  {paletteQuery.trim() === "" && askHistory.length === 0 && (
                    <>
                      <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted">
                        Suggested
                      </p>
                      {PALETTE_SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => runPaletteQuery(s)}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors duration-200 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <SearchIcon />
                          {s}
                        </button>
                      ))}
                    </>
                  )}

                  {/* Annotated log tied to the document — question, short answer,
                      citation chip. Not a chat transcript: no avatars, no bubbles. */}
                  {askHistory.length > 0 && (
                    <div className="space-y-2 px-1 py-1">
                      {askHistory.map((entry, i) => (
                        <div key={i} className="rounded-md border border-hairline bg-background/40 p-3">
                          <p className="text-[13px] font-medium text-muted">{entry.question}</p>
                          <p className="mt-1 text-sm leading-5 text-foreground">{entry.answer}</p>
                          <div className="mt-1.5">
                            <CiteChip actionable={false} label={entry.sourceHint || "No specific clause identified"} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {askLoading && (
                    <div className="flex items-center gap-2 px-2.5 py-3 text-sm text-muted">
                      <Spinner />
                      Thinking…
                    </div>
                  )}

                  {askError && (
                    <p role="alert" className="px-2.5 py-2 text-sm font-medium text-severity-high">
                      {askError}
                    </p>
                  )}

                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Source PDF viewer — opened by a citation button that has a real page number */}
      {viewerCitation && selectedFile && (
        <PdfViewer
          key={`${viewerCitation.page}-${viewerCitation.section ?? ""}`}
          file={selectedFile}
          page={viewerCitation.page}
          section={viewerCitation.section}
          onClose={() => setViewerCitation(null)}
        />
      )}

      {/* Same trigger, honest fallback — past analyses only ever stored the
          extracted data, never the source PDF, so there's nothing to open. */}
      {viewerCitation && !selectedFile && (
        <div
          role="presentation"
          onClick={() => setViewerCitation(null)}
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Source unavailable"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-md border border-hairline bg-surface p-5 text-center shadow-panel"
          >
            <p className="text-sm font-medium text-foreground">Original PDF not available</p>
            <p className="mt-1.5 text-sm leading-5 text-muted">
              This citation points to page {viewerCitation.page}
              {viewerCitation.section ? `, ${viewerCitation.section}` : ""} — but only the extracted data is saved for
              past analyses, not the source file.
            </p>
            <button
              type="button"
              onClick={() => setViewerCitation(null)}
              className="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Off-screen on every viewport; @media print in globals.css hides
          everything else and pulls this into view when handleExportPdf's
          window.print() runs. */}
      {analysis && (
        <ContractSummaryPrint
          analysis={analysis}
          fileName={selectedFile ? selectedFile.name : archivedFileName ?? "Contract"}
          analyzedAt={analyzedAt ?? new Date()}
        />
      )}
    </main>
  );
}
