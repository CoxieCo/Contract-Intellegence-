"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, DragEvent, KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import {
  CURRENT_ANALYSIS_STORAGE_KEY,
  VIEW_REQUEST_STORAGE_KEY,
  STREAM_CONTRACT_TEXT_DELIMITER,
} from "@/lib/contract-analysis";
import { clearLiveAnalysisFile, getLiveAnalysisFile, setLiveAnalysisFile } from "@/lib/liveFileSession";
import Spinner from "./components/Spinner";
import CiteChip from "./components/CiteChip";
import ContractSummaryPrint from "./components/ContractSummaryPrint";
import Landing from "./components/landing/Landing";
import ResultsView, { ResultsViewHandle } from "./components/results/ResultsView";

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

const PALETTE_SUGGESTIONS = [
  "Show termination clause",
  "Show all dates",
  "Show high-severity items",
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

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

// ---------- Main page ----------

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const resultsViewRef = useRef<ResultsViewHandle>(null);

  const [appState, setAppState] = useState<AppState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [contractText, setContractText] = useState("");

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

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteRendered, setPaletteRendered] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");

  const [viewerCitation, setViewerCitation] = useState<{ page: number; section: string | null } | null>(null);

  const openCitation = (page: number, section: string | null) => {
    setViewerCitation({ page, section });
  };

  const scrollToUpload = () => {
    uploadSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      setArchivedFileName(hydrate.fileName);
      setContractText("");
      setAnalyzedAt(new Date());
      setAppState("results");

      // If this is the contract just scanned in this same tab (e.g. a round
      // trip through the dashboard via "Back to Analysis"), the real source
      // PDF is still held outside React state and survived the navigation —
      // restoring it here means citations open the actual file instead of
      // falling back to the "not available" notice a genuinely past analysis
      // (loaded from storage, no live file) correctly still shows.
      const liveFile = getLiveAnalysisFile(hydrate.fileName);
      if (liveFile) setSelectedFile(liveFile);

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

  // ----- Command palette -----

  // Jumping to a field opens its section, scrolls to it and flashes a
  // highlight — all owned by ResultsView itself (it remounts fresh each
  // time a results view is entered, so there's no state to reset here).
  const jumpToField = (tab: TabKey, opts?: { highlightKey?: string; watchIndex?: number }) => {
    resultsViewRef.current?.jumpTo(tab, { fieldKey: opts?.highlightKey, watchIndex: opts?.watchIndex });
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
      jumpToField("watch");
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
    setContractText("");
    setAppState("idle");
    setViewerCitation(null);
    setAskHistory([]);
    setAskError("");
    sessionStorage.removeItem(CURRENT_ANALYSIS_STORAGE_KEY);
    setArchivedFileName(null);
    setAnalyzedAt(null);
    clearLiveAnalysisFile();

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
      }
      buffer += decoder.decode();

      const delimiterIndex = buffer.indexOf(STREAM_CONTRACT_TEXT_DELIMITER);
      const analysisText = delimiterIndex === -1 ? buffer : buffer.slice(0, delimiterIndex);
      const finalContractText = delimiterIndex === -1 ? "" : buffer.slice(delimiterIndex + STREAM_CONTRACT_TEXT_DELIMITER.length);

      const { data: parsed } = parseAnalysis(analysisText);

      if (!parsed) {
        setError("The analysis didn't come back in a format we could read. Please try again.");
        setAppState("fileSelected");
        return;
      }

      setAnalysis(parsed);
      setContractText(finalContractText);
      setLiveAnalysisFile(selectedFile);

      try {
        sessionStorage.setItem(
          CURRENT_ANALYSIS_STORAGE_KEY,
          JSON.stringify({ fileName: selectedFile.name, analysis: parsed })
        );
      } catch {
        // Session storage can fail (private browsing, quota) — the dashboard's
        // "currently open" card just won't have anything to show, harmless.
      }

      enterResultsView();
    } catch {
      setError("Couldn't reach the analysis service. Is the dev server running?");
      setAppState("fileSelected");
    }
  };

  // No PDF library involved — #print-summary-root (see globals.css's
  // @media print block) is already in the DOM, just hidden on screen, so
  // this only has to trigger the browser's own print dialog. "Save as PDF"
  // is one of its built-in destinations.
  const handleExportPdf = () => {
    window.print();
  };

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

      {/* Results view — same light "Industry" theme as Landing, imported from
          Results.dc.html. Owns its own nav/sidebar; no dark chrome around it. */}
      {appState === "results" && analysis && (
        <ResultsView
          ref={resultsViewRef}
          analysis={analysis}
          fileName={selectedFile ? selectedFile.name : (archivedFileName ?? "Contract")}
          analyzedAt={analyzedAt}
          onOpenCitation={openCitation}
          onExportPdf={handleExportPdf}
        />
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
