"use client";

import dynamic from "next/dynamic";
import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import {
  CURRENT_ANALYSIS_STORAGE_KEY,
  VIEW_REQUEST_STORAGE_KEY,
  STREAM_CONTRACT_TEXT_DELIMITER,
} from "@/lib/contract-analysis";
import { clearLiveAnalysisFile, getLiveAnalysisFile, setLiveAnalysisFile } from "@/lib/liveFileSession";
import ContractSummaryPrint from "./components/ContractSummaryPrint";
import Landing from "./components/landing/Landing";
import ScanningView from "./components/scan/ScanningView";
import ResultsView, { ResultSectionId, ResultsViewHandle } from "./components/results/ResultsView";
import AskContractView, { AskHistoryEntry } from "./components/ask/AskContractView";

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

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

// ---------- Helpers ----------

// Loaded lazily (never at module scope) so this stays out of the server
// render entirely — react-pdf's pdf.js sets up a worker via import.meta.url
// that only makes sense in the browser, same reasoning as PdfViewer.tsx's
// next/dynamic({ ssr: false }).
async function detectPageCount(file: File): Promise<number | null> {
  try {
    const { pdfjs } = await import("react-pdf");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
    const buffer = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    return doc.numPages;
  } catch {
    return null;
  }
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

// ---------- Main page ----------

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSectionRef = useRef<HTMLDivElement>(null);
  const resultsViewRef = useRef<ResultsViewHandle>(null);

  const [appState, setAppState] = useState<AppState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [contractText, setContractText] = useState("");

  // Drive the scan loading screen's file card and checklist. pageCount is
  // resolved client-side (pdf.js) right after a file is selected, purely for
  // display — analysis itself doesn't need it. scanStepsDone/scanPhase are
  // updated for real as each analysis section streams in (see handleContinue).
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [scanStepsDone, setScanStepsDone] = useState(0);
  const [scanPhase, setScanPhase] = useState<"scanning" | "complete">("scanning");

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

  // The Ask Your Contract page's conversation log — reset on every new scan.
  const [askHistory, setAskHistory] = useState<AskHistoryEntry[]>([]);
  const [askPendingQuestion, setAskPendingQuestion] = useState<string | null>(null);
  const [askError, setAskError] = useState("");

  // Whether the Ask Your Contract page is showing instead of ResultsView
  // (both stay mounted the whole time — see the render below — so jumping
  // from a citation or a recommendation back into a specific section always
  // has a live ResultsViewHandle to call, with no mount-order race). askSection
  // tracks "what was the user last looking at" — set on every jumpTo (sidebar
  // click, citation, recommendation) — and drives the Ask page's default
  // "Viewing: X" context and its suggested questions.
  const [viewingAsk, setViewingAsk] = useState(false);
  const [askSection, setAskSection] = useState<ResultSectionId>("overview");

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

  // ----- Ask Your Contract -----

  // Both ResultsView and AskContractView stay mounted the whole time (see the
  // render below, which toggles visibility rather than conditionally
  // rendering) — so jumping from a citation or a recommendation always has a
  // live resultsViewRef to call, regardless of which one is currently shown.
  const jumpFromAsk = (section: ResultSectionId, watchIndex?: number) => {
    resultsViewRef.current?.jumpTo(section, { watchIndex });
    setViewingAsk(false);
  };

  const askContract = async (question: string) => {
    const q = question.trim();
    if (!q || !contractText || askPendingQuestion) return;

    setAskPendingQuestion(q);
    setAskError("");

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

      setAskHistory((prev) => [...prev, { question: q, answer: data.answer, section: data.section ?? null }]);
    } catch {
      setAskError("Couldn't reach the AI. Is the dev server running?");
    } finally {
      setAskPendingQuestion(null);
    }
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

    // Page count for the scan loading screen's file card — display only, so
    // a failure or a race with a fast file swap just leaves it blank rather
    // than blocking anything. Guarded against a stale overwrite by checking
    // this is still the selected file once pdf.js resolves.
    setPageCount(null);
    void detectPageCount(file).then((count) => {
      setSelectedFile((current) => {
        if (current === file) setPageCount(count);
        return current;
      });
    });
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
    setPageCount(null);
    setAppState("idle");
    setViewerCitation(null);
    setAskHistory([]);
    setAskError("");
    setAskPendingQuestion(null);
    setViewingAsk(false);
    setAskSection("overview");
    sessionStorage.removeItem(CURRENT_ANALYSIS_STORAGE_KEY);
    setArchivedFileName(null);
    setAnalyzedAt(null);
    clearLiveAnalysisFile();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ----- Analysis -----

  // Fires when the user clicks "View results" on the (by then complete) scan
  // loading screen — the actual switch to ResultsView is manual rather than
  // automatic, so the checklist's finished state is always seen.
  const viewResults = () => {
    setViewerCitation(null);
    setAskHistory([]);
    setAskError("");
    setAskPendingQuestion(null);
    setViewingAsk(false);
    setAskSection("overview");
    setAppState("results");
  };

  const handleContinue = async () => {
    if (!selectedFile) return;

    setAppState("analyzing");
    setError("");
    setAnalysis(null);
    setContractText("");
    setScanStepsDone(0);
    setScanPhase("scanning");

    const seenKeys = new Set<keyof ContractAnalysis>();

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

        // The scan loading screen's checklist mirrors PARTIAL_ANALYSIS_KEYS'
        // fixed order (which matches the key order Claude is asked to stream
        // the JSON in) — count how many keys from the front are in, so a
        // later section landing before an earlier one never shows a gap.
        let leadingDone = 0;
        while (leadingDone < PARTIAL_ANALYSIS_KEYS.length && seenKeys.has(PARTIAL_ANALYSIS_KEYS[leadingDone])) {
          leadingDone++;
        }
        setScanStepsDone(leadingDone);
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

      setAnalyzedAt(new Date());
      setScanStepsDone(PARTIAL_ANALYSIS_KEYS.length);
      setScanPhase("complete");
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
          upload/footer. Swapped out entirely once a scan starts. */}
      {(appState === "idle" || appState === "fileSelected") && (
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

      {/* Full-screen scan loading view — same light "Industry" theme, imported
          from Scan Loading Screen.dc.html. Checklist rows track real analysis
          sections as they stream in; "View results" only appears once every
          section is done. */}
      {appState === "analyzing" && selectedFile && (
        <ScanningView
          fileName={selectedFile.name}
          pageCount={pageCount}
          stepsDone={scanStepsDone}
          phase={scanPhase}
          onViewResults={viewResults}
        />
      )}

      {/* Results view — same light "Industry" theme as Landing, imported from
          Results.dc.html. Owns its own nav/sidebar; no dark chrome around it.
          Stays mounted (visibility toggled, not conditionally rendered)
          whenever the Ask Your Contract page is showing instead, so its
          sidebar/section state survives the round trip and resultsViewRef
          is always safe to call from AskContractView's citations. */}
      {appState === "results" && analysis && (
        <div style={{ display: viewingAsk ? "none" : "block" }}>
          <ResultsView
            ref={resultsViewRef}
            analysis={analysis}
            fileName={selectedFile ? selectedFile.name : (archivedFileName ?? "Contract")}
            analyzedAt={analyzedAt}
            onOpenCitation={openCitation}
            onExportPdf={handleExportPdf}
            onAskContract={() => setViewingAsk(true)}
            onSectionChange={(section) => setAskSection(section)}
          />
        </div>
      )}

      {/* Ask Your Contract — full-screen page imported from the same-named
          design, replacing the old Cmd+K command palette entirely (its
          deterministic "jump to a field" search is already covered by the
          results sidebar). */}
      {appState === "results" && analysis && viewingAsk && (
        <AskContractView
          fileName={selectedFile ? selectedFile.name : (archivedFileName ?? "Contract")}
          section={askSection}
          thingsToWatch={analysis.thingsToWatch ?? []}
          history={askHistory}
          pendingQuestion={askPendingQuestion}
          error={askError}
          onAsk={(question) => void askContract(question)}
          onBack={() => setViewingAsk(false)}
          onJumpToSection={jumpFromAsk}
        />
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
