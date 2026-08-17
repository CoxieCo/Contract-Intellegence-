"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, DragEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";

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
type ViewMode = "quickScan" | "fullReview" | "ask";

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

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "dates", label: "Dates" },
  { key: "terms", label: "Terms" },
  { key: "clauses", label: "Clauses" },
  { key: "watch", label: "Things to watch" },
];

const MODE_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: "quickScan", label: "Quick Scan" },
  { key: "fullReview", label: "Full Review" },
  { key: "ask", label: "Ask" },
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

// ---------- Marketing content ----------
// NOTE: coverage list below is descriptive ("what fields we extract"), not a live
// uptime/testing claim — don't add fake "last checked Xhrs ago" timestamps unless
// you actually have real monitoring behind them. Same for pricing: adjust the
// "was $X" figures only if that reflects a real prior price, otherwise drop the
// strikethrough rather than imply a discount that didn't happen.

const coverageItems = [
  { label: "Renewal & notice dates", note: "Start, end, renewal, notice period, notice deadline" },
  { label: "Payment & pricing terms", note: "Value, currency, payment terms, escalation" },
  { label: "Liability & indemnification", note: "Liability, liability cap, indemnity language" },
  { label: "Termination conditions", note: "Termination, early termination triggers" },
  { label: "Governing law & compliance", note: "Jurisdiction, data/compliance obligations" },
  { label: "Conflicting clause detection", note: "Flags when multiple clauses affect one field" },
];

const pricingTiers = [
  {
    name: "Starter",
    price: "$49",
    originalPrice: "$79",
    period: "/month",
    description: "For small ops teams getting started",
    features: [
      "Up to 25 contracts / month",
      "Full 5-category extraction",
      "Things to Watch risk flags",
      "Email support",
    ],
    highlighted: false,
  },
  {
    name: "Team",
    price: "$149",
    originalPrice: "$249",
    period: "/month",
    description: "For growing operations teams",
    features: [
      "Up to 150 contracts / month",
      "Full 5-category extraction",
      "Things to Watch risk flags",
      "Priority support",
      "Shared team workspace",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    originalPrice: null,
    period: "",
    description: "For larger contract volumes",
    features: [
      "Unlimited contracts",
      "Full 5-category extraction",
      "Things to Watch risk flags",
      "Dedicated support",
      "Custom field extraction",
    ],
    highlighted: false,
  },
];

// ---------- Helpers ----------

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

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function SpinnerIcon() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-hairline-strong border-t-accent" />;
}

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

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// ---------- Presentational pieces ----------

function CiteSourceButton({
  page,
  section,
  onOpen,
}: {
  page?: number | null;
  section?: string | null;
  onOpen?: (page: number, section: string | null) => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!show) return;
    const timeout = setTimeout(() => setShow(false), 2500);
    return () => clearTimeout(timeout);
  }, [show]);

  const hasLocation = page != null;
  const label = section ? `${section} →` : hasLocation ? `Page ${page} →` : "Cite source";

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (hasLocation && onOpen) onOpen(page, section ?? null);
          else setShow((s) => !s);
        }}
        className="whitespace-nowrap rounded border border-hairline bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted transition-colors duration-200 hover:border-hairline-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {label}
      </button>
      {show && !hasLocation && (
        <span
          role="status"
          className="absolute right-0 top-full z-10 mt-1 w-max max-w-[220px] rounded-md border border-hairline bg-surface-raised px-2 py-1 text-[11px] leading-4 text-muted shadow-panel"
        >
          Source citation coming soon
        </span>
      )}
    </span>
  );
}

function FieldRow({
  label,
  field,
  mono,
  highlighted,
  forwardedRef,
  onOpenCitation,
}: {
  label: string;
  field: SourcedValue;
  mono?: boolean;
  highlighted?: boolean;
  forwardedRef?: (el: HTMLDivElement | null) => void;
  onOpenCitation?: (page: number, section: string | null) => void;
}) {
  const notFound = field.value === "Not found";
  return (
    <div
      ref={forwardedRef}
      className={`flex flex-col gap-1 rounded-md border-b border-hairline py-2.5 first:pt-0 last:border-0 last:pb-0 transition-colors duration-300 sm:flex-row sm:items-start sm:justify-between sm:gap-6 ${
        highlighted ? "border-transparent bg-accent/10 px-2 ring-1 ring-accent" : ""
      }`}
    >
      <span className="text-sm font-medium text-muted sm:w-48 sm:shrink-0">{label}</span>
      <span className="flex flex-1 items-start justify-end gap-2">
        <span
          className={`text-sm leading-5 tabular-nums sm:text-right ${mono ? "font-mono" : ""} ${
            notFound ? "italic text-muted" : "text-foreground"
          }`}
        >
          {field.value}
        </span>
        <CiteSourceButton page={field.page} section={field.section} onOpen={onOpenCitation} />
      </span>
    </div>
  );
}

function severityStyles(severity: ThingToWatch["severity"]) {
  switch (severity) {
    case "HIGH":
      return "bg-severity-high-bg text-severity-high border-severity-high-border";
    case "MEDIUM":
      return "bg-severity-medium-bg text-severity-medium border-severity-medium-border";
    case "LOW":
    default:
      return "bg-severity-low-bg text-severity-low border-severity-low-border";
  }
}

function WatchAccordionItem({
  item,
  open,
  onToggle,
  onWhyRisky,
  highlighted,
  forwardedRef,
  onOpenCitation,
}: {
  item: ThingToWatch;
  open: boolean;
  onToggle: () => void;
  onWhyRisky: () => void;
  highlighted?: boolean;
  forwardedRef?: (el: HTMLDivElement | null) => void;
  onOpenCitation?: (page: number, section: string | null) => void;
}) {
  return (
    <div
      ref={forwardedRef}
      className={`rounded-md border-b border-hairline transition-colors duration-300 last:border-0 ${
        highlighted ? "border-transparent bg-accent/10 ring-1 ring-accent" : ""
      }`}
    >
      <div className="flex w-full items-center justify-between gap-3 py-2.5 pl-1">
        <button
          type="button"
          onClick={onToggle}
          className="flex flex-1 items-center gap-2.5 text-left text-muted transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ChevronIcon open={open} />
          <span className={`rounded border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide ${severityStyles(item.severity)}`}>
            {item.severity}
          </span>
          <span className="text-sm font-medium text-foreground">{item.title}</span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5 pr-1">
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
          <CiteSourceButton page={item.page} section={item.section} onOpen={onOpenCitation} />
        </div>
      </div>
      {open && (
        <p className="animate-fade-in pb-2.5 pl-7 pr-2 text-sm leading-5 text-muted">{item.explanation}</p>
      )}
    </div>
  );
}

// ---------- Main page ----------

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const fieldRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const watchRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const [appState, setAppState] = useState<AppState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [rawAnalysis, setRawAnalysis] = useState("");
  const [contractText, setContractText] = useState("");
  const [copied, setCopied] = useState(false);

  const [askQuestion, setAskQuestion] = useState("");
  const [askHistory, setAskHistory] = useState<{ question: string; answer: string; sourceHint?: string }[]>([]);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState("");

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [openWatchItems, setOpenWatchItems] = useState<Set<number>>(new Set([0]));

  const [viewMode, setViewMode] = useState<ViewMode>("quickScan");
  const [watchSortHighFirst, setWatchSortHighFirst] = useState(false);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteMessage, setPaletteMessage] = useState<string | null>(null);
  const [paletteAsking, setPaletteAsking] = useState(false);
  const [paletteAnswer, setPaletteAnswer] = useState<{ question: string; answer: string; sourceHint?: string } | null>(null);

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

  const registerFieldRef = (tab: TabKey, key: string) => (el: HTMLDivElement | null) => {
    const mapKey = `${tab}-${key}`;
    if (el) fieldRefs.current.set(mapKey, el);
    else fieldRefs.current.delete(mapKey);
  };

  const registerWatchRef = (index: number) => (el: HTMLDivElement | null) => {
    if (el) watchRefs.current.set(index, el);
    else watchRefs.current.delete(index);
  };

  // ----- Global keyboard shortcut (Cmd+K / Ctrl+K, Escape) -----

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteQuery("");
        setPaletteMessage(null);
        setPaletteAnswer(null);
        setPaletteOpen(true);
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

  const jumpToTab = (
    tab: TabKey,
    opts?: { highlightKey?: string; watchIndex?: number; sortWatchHighFirst?: boolean }
  ) => {
    setViewMode("fullReview");
    setActiveTab(tab);
    setHighlight(opts?.highlightKey ? { tab, key: opts.highlightKey } : null);
    setHighlightWatchIndex(opts?.watchIndex ?? null);
    if (opts?.watchIndex !== undefined) {
      setOpenWatchItems((prev) => new Set(prev).add(opts.watchIndex!));
    }
    if (opts?.sortWatchHighFirst) setWatchSortHighFirst(true);
    setPaletteOpen(false);
    setPaletteQuery("");
    setPaletteMessage(null);
    setPaletteAnswer(null);
    setPaletteAsking(false);
  };

  const askContract = async (question: string) => {
    if (!contractText) {
      setPaletteMessage("No matching field found — try Ask mode for open-ended questions.");
      return;
    }

    setPaletteAsking(true);
    setPaletteMessage(null);
    setPaletteAnswer(null);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractText, question }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPaletteMessage(data.error || "Couldn't get an answer. Try again.");
        return;
      }

      setPaletteAnswer({ question, answer: data.answer, sourceHint: data.sourceHint });
    } catch {
      setPaletteMessage("Couldn't reach the AI. Is the dev server running?");
    } finally {
      setPaletteAsking(false);
    }
  };

  const runPaletteQuery = (rawQuery: string) => {
    setPaletteQuery(rawQuery);
    setPaletteAnswer(null);
    const query = normalize(rawQuery);
    if (!analysis || !query) return;

    const match = findBestMatch(rawQuery, buildSearchIndex(analysis));
    if (match) {
      jumpToTab(match.tab, {
        highlightKey: match.watchIndex === undefined ? match.key : undefined,
        watchIndex: match.watchIndex,
      });
      return;
    }

    if (query.includes("severity") || query.includes("risky") || query.includes("risk")) {
      jumpToTab("watch", { sortWatchHighFirst: true });
      return;
    }
    if (query.includes("date")) {
      jumpToTab("dates");
      return;
    }
    if (query.includes("overview")) {
      jumpToTab("overview");
      return;
    }
    if (
      query.includes("terms") ||
      query.includes("commercial") ||
      query.includes("payment") ||
      query.includes("pricing")
    ) {
      jumpToTab("terms");
      return;
    }
    if (query.includes("clause")) {
      jumpToTab("clauses");
      return;
    }
    if (query.includes("watch")) {
      jumpToTab("watch");
      return;
    }

    void askContract(rawQuery);
  };

  const handlePaletteKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") runPaletteQuery(paletteQuery);
  };

  // ----- Ask mode -----

  const submitAsk = async (question: string) => {
    const q = question.trim();
    if (!q || !contractText || askLoading) return;

    setAskLoading(true);
    setAskError("");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractText, question: q }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAskError(data.error || "Couldn't get an answer.");
        return;
      }

      setAskHistory((prev) => [...prev, { question: q, answer: data.answer, sourceHint: data.sourceHint }]);
      setAskQuestion("");
    } catch {
      setAskError("Couldn't reach the AI. Is the dev server running?");
    } finally {
      setAskLoading(false);
    }
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
    setWatchSortHighFirst(false);
    setHighlight(null);
    setHighlightWatchIndex(null);
    setViewerCitation(null);
    setAskHistory([]);
    setAskQuestion("");
    setAskError("");

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

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong analyzing the PDF.");
        setAppState("fileSelected");
        return;
      }

      const { data: parsed, raw } = parseAnalysis(data.analysis ?? "");
      setAnalysis(parsed);
      setRawAnalysis(raw);
      setContractText(typeof data.contractText === "string" ? data.contractText : "");
      setActiveTab("overview");

      const topHighIndex = parsed?.thingsToWatch?.findIndex((w) => w.severity === "HIGH") ?? -1;
      setOpenWatchItems(new Set([topHighIndex >= 0 ? topHighIndex : 0]));

      setViewMode("quickScan");
      setWatchSortHighFirst(false);
      setHighlight(null);
      setHighlightWatchIndex(null);
      setViewerCitation(null);
      setAskHistory([]);
      setAskQuestion("");
      setAskError("");
      setAppState("results");
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
    setWatchSortHighFirst(false);
    setHighlight(null);
    setHighlightWatchIndex(null);
    setViewerCitation(null);
    setAskHistory([]);
    setAskQuestion("");
    setAskError("");

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

  const watchCount = analysis?.thingsToWatch?.length ?? 0;
  const highCount = analysis?.thingsToWatch?.filter((w) => w.severity === "HIGH").length ?? 0;

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

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Top bar — sticky with a subtle frosted-glass treatment, the only place we use it */}
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
            <a href="#coverage" className="transition-colors duration-200 hover:text-foreground">Coverage</a>
            <a href="#pricing" className="transition-colors duration-200 hover:text-foreground">Pricing</a>
          </div>
          <button
            type="button"
            className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Sign in
          </button>
        </div>
      </header>

      {/* Big bold hero — only shown before results, so it doesn't compete with the dashboard */}
      {appState !== "results" && (
        <section className="relative overflow-hidden border-b border-hairline bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(91,121,255,0.14),transparent)]">
          <div className="animate-fade-in mx-auto max-w-4xl px-6 py-20 text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3.5 py-1.5 text-xs font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              AI-powered contract intelligence
            </div>

            <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-[-0.035em] text-foreground sm:text-5xl lg:text-6xl">
              Never miss a renewal,
              <span className="block text-muted">a deadline, or a risky clause.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-7 text-muted">
              Upload any contract PDF and get every date, term, and clause worth
              reviewing — extracted in seconds, sourced back to the document.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={scrollToUpload}
                className="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-glow-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Analyze a contract — free
              </button>
              <a
                href="#pricing"
                className="rounded-md border border-hairline bg-surface px-6 py-3 text-sm font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                See pricing
              </a>
            </div>
            <p className="mt-4 text-xs text-muted">No credit card required</p>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Compact header shown only inside the results view (hero covers this pre-analysis) */}
        {appState === "results" && (
          <div className="animate-fade-in mb-6">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Contracts</h1>
            <p className="mt-1 text-sm text-muted">
              Upload a PDF to extract key terms, dates, and provisions worth reviewing.
            </p>
          </div>
        )}

        {/* Upload panel */}
        {appState !== "results" && (
          <div ref={uploadSectionRef} className="animate-fade-in mx-auto w-full max-w-2xl scroll-mt-20">
            <div className="rounded-lg border border-hairline bg-surface p-2 shadow-panel">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`flex min-h-[220px] flex-col items-center justify-center rounded-md border border-dashed px-6 py-9 transition-colors duration-200 ${
                  isDragging
                    ? "border-accent bg-surface-raised"
                    : "border-hairline bg-background/40 hover:border-hairline-strong hover:bg-surface-raised"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileInput}
                  className="hidden"
                />

                {appState === "idle" && (
                  <>
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-hairline bg-surface-raised text-muted">
                      <UploadIcon />
                    </div>
                    <h2 className="text-[15px] font-semibold text-foreground">
                      Upload a contract
                    </h2>
                    <p className="mt-1.5 max-w-md text-sm leading-6 text-muted">
                      Drag and drop a PDF here, or select one from your computer.
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-glow-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      Select PDF
                    </button>
                    <p className="mt-3 text-xs text-muted">PDF files only, up to 15MB</p>
                  </>
                )}

                {appState === "fileSelected" && selectedFile && (
                  <>
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-accent text-white">
                      <FileIcon />
                    </div>
                    <h2 className="max-w-full truncate px-4 text-[15px] font-semibold text-foreground">
                      {selectedFile.name}
                    </h2>
                    <p className="mt-1.5 text-sm tabular-nums text-muted">{formatFileSize(selectedFile.size)}</p>

                    <div className="mt-5 flex gap-2.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-md border border-hairline bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        Replace PDF
                      </button>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="rounded-md border border-hairline bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        Remove
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleContinue}
                      className="mt-4 rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-glow-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      Continue
                    </button>
                  </>
                )}

                {appState === "analyzing" && (
                  <>
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-hairline bg-surface-raised">
                      <SpinnerIcon />
                    </div>
                    <h2 className="text-[15px] font-semibold text-foreground">
                      Analyzing your contract…
                    </h2>
                    <p className="mt-1.5 max-w-md text-sm leading-6 text-muted">
                      Reading through {selectedFile?.name ?? "your document"}. This usually takes a few seconds.
                    </p>
                  </>
                )}
              </div>

              {error && (
                <p role="alert" className="mt-3 text-center text-sm font-medium text-severity-high">
                  {error}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Results — dashboard panel with mode switcher, tabs + accordion */}
        {appState === "results" && (
          <div className="animate-fade-in mx-auto w-full max-w-4xl">
            <div className="rounded-lg border border-hairline bg-surface shadow-panel">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Analysis results</h2>
                  {selectedFile && (
                    <p className="mt-0.5 text-sm text-muted">
                      {selectedFile.name}
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
                  <div className="flex flex-wrap items-center gap-1 border-b border-hairline px-4 py-2.5">
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
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Key facts</p>
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
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Top risk</p>
                          <WatchAccordionItem
                            item={topHighItem}
                            open={openWatchItems.has(topHighIndex)}
                            onToggle={() => toggleWatchItem(topHighIndex)}
                            onWhyRisky={() => handleWhyRisky(topHighIndex)}
                            onOpenCitation={openCitation}
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
                    <>
                      <div className="flex gap-1 overflow-x-auto border-b border-hairline px-4 pt-2">
                        {TABS.map((tab) => {
                          const isWatchTab = tab.key === "watch";
                          const active = activeTab === tab.key;
                          return (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setActiveTab(tab.key)}
                              className={`whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                                active
                                  ? "border-accent text-foreground"
                                  : "border-transparent text-muted hover:text-foreground"
                              }`}
                            >
                              {tab.label}
                              {isWatchTab && watchCount > 0 && (
                                <span
                                  className={`ml-1.5 rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums ${
                                    highCount > 0
                                      ? "bg-severity-high-bg text-severity-high"
                                      : "bg-surface-raised text-muted"
                                  }`}
                                >
                                  {watchCount}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div key={activeTab} className="animate-fade-in px-5 py-4">
                        {activeTab === "overview" && analysis.contractOverview && (
                          <div>
                            {(Object.keys(overviewLabels) as (keyof ContractOverview)[]).map((key) => (
                              <FieldRow
                                key={key}
                                label={overviewLabels[key]}
                                field={analysis.contractOverview![key]}
                                highlighted={highlight?.tab === "overview" && highlight.key === key}
                                forwardedRef={registerFieldRef("overview", key)}
                                onOpenCitation={openCitation}
                              />
                            ))}
                          </div>
                        )}

                        {activeTab === "dates" && analysis.importantDates && (
                          <div>
                            {(Object.keys(datesLabels) as (keyof ImportantDates)[]).map((key) => (
                              <FieldRow
                                key={key}
                                label={datesLabels[key]}
                                field={analysis.importantDates![key]}
                                mono
                                highlighted={highlight?.tab === "dates" && highlight.key === key}
                                forwardedRef={registerFieldRef("dates", key)}
                                onOpenCitation={openCitation}
                              />
                            ))}
                          </div>
                        )}

                        {activeTab === "terms" && analysis.commercialTerms && (
                          <div>
                            {(Object.keys(termsLabels) as (keyof CommercialTerms)[]).map((key) => (
                              <FieldRow
                                key={key}
                                label={termsLabels[key]}
                                field={analysis.commercialTerms![key]}
                                mono
                                highlighted={highlight?.tab === "terms" && highlight.key === key}
                                forwardedRef={registerFieldRef("terms", key)}
                                onOpenCitation={openCitation}
                              />
                            ))}
                          </div>
                        )}

                        {activeTab === "clauses" && analysis.keyClauses && (
                          <div>
                            {(Object.keys(clausesLabels) as (keyof KeyClauses)[]).map((key) => (
                              <FieldRow
                                key={key}
                                label={clausesLabels[key]}
                                field={analysis.keyClauses![key]}
                                highlighted={highlight?.tab === "clauses" && highlight.key === key}
                                forwardedRef={registerFieldRef("clauses", key)}
                                onOpenCitation={openCitation}
                              />
                            ))}
                          </div>
                        )}

                        {activeTab === "watch" && (
                          <div>
                            {watchCount > 0 ? (
                              displayedWatchItems.map(({ item, i }) => (
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
                              ))
                            ) : (
                              <p className="text-sm text-muted">Nothing flagged for review.</p>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {viewMode === "ask" && (
                    <div className="animate-fade-in px-5 py-4">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                        Ask about this contract
                      </p>
                      <p className="mb-4 text-xs text-muted">
                        Answers are generated only from the uploaded contract text.
                      </p>

                      {askHistory.length > 0 && (
                        <div className="mb-4 space-y-3">
                          {askHistory.map((entry, i) => (
                            <div key={i} className="rounded-md border border-hairline bg-background/40 p-3">
                              <p className="text-sm font-medium text-foreground">{entry.question}</p>
                              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-muted">{entry.answer}</p>
                              {entry.sourceHint && (
                                <p className="mt-1.5 text-xs text-muted">Source: {entry.sourceHint}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {askLoading && (
                        <div className="mb-4 flex items-center gap-2 text-sm text-muted">
                          <SpinnerIcon />
                          Thinking…
                        </div>
                      )}

                      {askError && (
                        <p role="alert" className="mb-4 text-sm font-medium text-severity-high">
                          {askError}
                        </p>
                      )}

                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void submitAsk(askQuestion);
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="text"
                          value={askQuestion}
                          onChange={(e) => setAskQuestion(e.target.value)}
                          placeholder="Ask a question about this contract…"
                          className="flex-1 rounded-md border border-hairline bg-background/40 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        />
                        <button
                          type="submit"
                          disabled={askLoading || !askQuestion.trim()}
                          className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                        >
                          Ask
                        </button>
                      </form>
                    </div>
                  )}
                </>
              ) : (
                <div className="px-5 py-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
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

      {/* Extraction coverage — status-bar-style section, only on the marketing view */}
      {appState !== "results" && (
        <section id="coverage" className="border-t border-hairline bg-surface/40">
          <div className="mx-auto max-w-4xl px-6 py-16">
            <div className="mb-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Coverage</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
                What we extract from every contract
              </h2>
            </div>

            <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-panel">
              {coverageItems.map((item, i) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between gap-4 px-5 py-4 ${
                    i !== coverageItems.length - 1 ? "border-b border-hairline" : ""
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="mt-0.5 text-xs text-muted">{item.note}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-surface-raised px-2.5 py-1 text-xs font-medium text-foreground">
                    <CheckIcon />
                    Supported
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pricing */}
      {appState !== "results" && (
        <section id="pricing" className="border-t border-hairline">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="mb-10 text-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Pricing</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
                Simple, transparent pricing
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {pricingTiers.map((tier) => (
                <div
                  key={tier.name}
                  className={`relative flex flex-col rounded-lg border bg-surface p-6 transition-all duration-200 hover:-translate-y-0.5 ${
                    tier.highlighted
                      ? "border-accent shadow-glow-accent"
                      : "border-hairline shadow-panel hover:shadow-panel-hover"
                  }`}
                >
                  {tier.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-white">
                      Most popular
                    </span>
                  )}

                  <h3 className="text-sm font-semibold text-foreground">{tier.name}</h3>
                  <p className="mt-1 text-sm text-muted">{tier.description}</p>

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold tracking-[-0.02em] tabular-nums text-foreground">{tier.price}</span>
                    <span className="text-sm text-muted">{tier.period}</span>
                  </div>
                  {tier.originalPrice && (
                    <p className="mt-1 text-xs tabular-nums text-muted line-through">{tier.originalPrice}{tier.period}</p>
                  )}

                  <ul className="mt-6 flex-1 space-y-2.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-muted">
                        <span className="mt-0.5 text-accent"><CheckIcon /></span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={scrollToUpload}
                    className={`mt-6 rounded-md px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
                      tier.highlighted
                        ? "bg-accent text-white hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-glow-accent"
                        : "border border-hairline bg-surface text-foreground hover:border-hairline-strong hover:bg-surface-raised"
                    }`}
                  >
                    {tier.name === "Enterprise" ? "Contact sales" : "Get started"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Contract Intelligence</span>
          <span>AI-powered contract analysis</span>
        </div>
      </footer>

      {/* Persistent AI affordance — quiet, corner-anchored, present on every screen */}
      <button
        type="button"
        onClick={() => {
          setPaletteQuery("");
          setPaletteMessage(null);
          setPaletteAnswer(null);
          setPaletteOpen(true);
        }}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full border border-hairline bg-surface/90 px-3.5 py-2 text-xs font-medium text-muted shadow-panel backdrop-blur-md transition-colors duration-200 hover:border-hairline-strong hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        Ask AI
        <span className="ml-0.5 rounded border border-hairline-strong px-1 py-0.5 text-[10px] leading-none text-muted">⌘K</span>
      </button>

      {/* Command palette */}
      {paletteOpen && (
        <div
          role="presentation"
          onClick={() => setPaletteOpen(false)}
          className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-lg border border-hairline bg-surface shadow-panel"
          >
            <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3">
              <input
                ref={paletteInputRef}
                type="text"
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value);
                  setPaletteMessage(null);
                  setPaletteAnswer(null);
                }}
                onKeyDown={handlePaletteKeyDown}
                placeholder={analysis ? 'Search fields — e.g. "termination clause"' : "Upload a contract to get started"}
                disabled={!analysis}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none disabled:cursor-not-allowed"
              />
              <kbd className="rounded border border-hairline-strong px-1.5 py-0.5 text-[10px] text-muted">Esc</kbd>
            </div>

            <div className="max-h-72 overflow-y-auto px-2 py-2">
              {!analysis ? (
                <p className="px-2.5 py-3 text-sm text-muted">Upload a contract to get started.</p>
              ) : paletteQuery.trim() === "" ? (
                <>
                  <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Suggested
                  </p>
                  {PALETTE_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => runPaletteQuery(s)}
                      className="block w-full rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors duration-150 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {s}
                    </button>
                  ))}
                </>
              ) : paletteAsking ? (
                <div className="flex items-center gap-2 px-2.5 py-3 text-sm text-muted">
                  <SpinnerIcon />
                  Thinking…
                </div>
              ) : paletteAnswer ? (
                <div className="px-2.5 py-2.5">
                  <p className="text-sm leading-5 text-foreground">{paletteAnswer.answer}</p>
                  {paletteAnswer.sourceHint && (
                    <p className="mt-1.5 text-xs text-muted">Source: {paletteAnswer.sourceHint}</p>
                  )}
                </div>
              ) : paletteMessage ? (
                <p className="px-2.5 py-3 text-sm text-muted">{paletteMessage}</p>
              ) : (
                <p className="px-2.5 py-3 text-xs text-muted">Press Enter to search — no matching field will ask the AI directly.</p>
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
    </main>
  );
}
