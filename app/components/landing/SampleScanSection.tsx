"use client";

// Standalone "pick a sample contract" section — a deliberate, user-triggered
// demo, separate from HeroDemo's ambient hero illustration above. Visitors
// choose one of 3 pre-generated sample contracts (by dragging its icon card
// onto the drop zone, clicking "Try it →", or using the "Select PDF"
// fallback), confirm it on a simple "ready to scan" card, then watch the
// real ScanningView checklist and real ResultsView play out below — the
// same two components a genuine scan uses, just fed pre-generated sample
// data instead of a real /api/analyze call.
//
// Nothing here ever reads a real file. The drag mechanism only recognizes
// the icon cards' own custom dataTransfer type — a real file dragged onto
// the drop zone carries no data of that type, so dragOver never calls
// preventDefault and the drop falls through to the browser's default
// (do-nothing-useful) handling. The "Select PDF" fallback opens a real
// native file picker purely as a familiar click-based trigger gesture:
// whatever file is chosen is discarded unread, and the active sample's
// pre-generated data plays regardless — matching the on-page promise that
// nothing is uploaded and no contract of the visitor's is analyzed.

import { ChangeEvent, CSSProperties, DragEvent, useEffect, useRef, useState } from "react";
import { DemoContract, SAMPLE_CONTRACTS } from "./sampleContracts";
import { IconArrowRight, IconUpload } from "./icons";
import ScanningView, { ScanPhase } from "../scan/ScanningView";
import ResultsView from "../results/ResultsView";

// Custom dataTransfer type used for the sample-card drag. Deliberately
// namespaced and non-standard so it can never collide with a real file
// drag, which reports the standard "Files" type instead.
const SAMPLE_DRAG_TYPE = "application/x-ci-sample-contract-id";

// Matches the fixed 5-row checklist ScanningView always renders (contract
// identity, dates, terms, clauses, things to watch) — see that component's
// SCAN_STEPS. Not imported from there since it isn't exported; there's
// nothing to keep in sync beyond this count.
const SAMPLE_SCAN_STEPS = 5;
const SAMPLE_SCAN_STEP_DELAY_MS = 450;

type FlowPhase = "confirm" | "scanning" | "results";

function FileGlyph({ small, style }: { small?: boolean; style?: CSSProperties }) {
  const size = small ? 10 : 15;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Sample mode has no real PDF, print root, or Ask Your Contract flow behind
// it — ResultsView renders these same buttons for a genuine scan, but here
// they're inert.
function noop() {}

export default function SampleScanSection() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [flowPhase, setFlowPhase] = useState<FlowPhase | null>(null);
  const [scanStepsDone, setScanStepsDone] = useState(0);
  const [scanPhase, setScanPhase] = useState<ScanPhase>("scanning");
  const [analyzedAt, setAnalyzedAt] = useState<Date | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active: DemoContract | null = activeId ? SAMPLE_CONTRACTS.find((c) => c.id === activeId) ?? null : null;

  const dim = "color-mix(in srgb, var(--color-text) 55%, transparent)";
  const dim70 = "color-mix(in srgb, var(--color-text) 78%, transparent)";

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  // Picking (or re-picking) a sample always lands on the confirm card first —
  // scanning only starts once the visitor clicks "Scan", same as a real
  // upload waits for "Continue".
  const trigger = (id: string) => {
    const contract = SAMPLE_CONTRACTS.find((c) => c.id === id);
    if (!contract) return;
    clearTimers();
    setActiveId(id);
    setFlowPhase("confirm");
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  const startScan = () => {
    clearTimers();
    setScanStepsDone(0);
    setScanPhase("scanning");
    setFlowPhase("scanning");

    if (prefersReducedMotion()) {
      setScanStepsDone(SAMPLE_SCAN_STEPS);
      setScanPhase("complete");
      return;
    }

    for (let i = 1; i <= SAMPLE_SCAN_STEPS; i++) {
      timers.current.push(setTimeout(() => setScanStepsDone(i), i * SAMPLE_SCAN_STEP_DELAY_MS));
    }
    timers.current.push(
      setTimeout(() => setScanPhase("complete"), SAMPLE_SCAN_STEPS * SAMPLE_SCAN_STEP_DELAY_MS + 250)
    );
  };

  const viewResults = () => {
    setAnalyzedAt(new Date());
    setFlowPhase("results");
  };

  const backToPicker = () => {
    clearTimers();
    setFlowPhase(null);
    setActiveId(null);
    document.getElementById("sample-scan")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleCardDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData(SAMPLE_DRAG_TYPE, id);
    e.dataTransfer.effectAllowed = "copy";
  };

  // Only ever inspects our own custom type. A real file drag reports type
  // "Files", never SAMPLE_DRAG_TYPE, so this intentionally does nothing for
  // it — no preventDefault, no drop handler fires, browser default applies.
  const [isDropTarget, setIsDropTarget] = useState(false);
  const handleZoneDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(SAMPLE_DRAG_TYPE)) return;
    e.preventDefault();
    setIsDropTarget(true);
  };

  const handleZoneDragLeave = () => setIsDropTarget(false);

  const handleZoneDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(SAMPLE_DRAG_TYPE)) return;
    e.preventDefault();
    setIsDropTarget(false);
    trigger(e.dataTransfer.getData(SAMPLE_DRAG_TYPE));
  };

  // Whatever file the visitor picks here is never read — this button is a
  // click-based fallback to dragging, not a real upload. It just launches
  // the sample scan for the currently active (or first) contract.
  const handleFileFallback = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = "";
    trigger(activeId ?? SAMPLE_CONTRACTS[0].id);
  };

  return (
    <section id="sample-scan" data-screen-label="Sample scan" style={{ padding: "88px 0 32px" }}>
      <span style={{ display: "block", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-accent-700)", marginBottom: 12 }}>
        Sample scan · See it in action
      </span>
      <hr style={{ height: 1, border: 0, background: "var(--color-divider)", margin: "0 0 20px" }} />
      <h2 style={{ fontSize: "clamp(28px,3.4vw,44px)", lineHeight: 1.06, letterSpacing: "0.01em", textTransform: "uppercase", margin: "0 0 16px" }}>
        Pick a sample contract
      </h2>
      <p style={{ fontSize: 15, lineHeight: "24px", margin: "0 0 6px", maxWidth: "62ch", color: dim70 }}>
        Choose one below to watch the full scan-to-results experience, start to finish. Every field, date and clause
        you’ll see comes from pre-generated sample data — nothing is uploaded, and no contract of yours is analyzed.
      </p>
      <p style={{ fontSize: 13, lineHeight: "20px", margin: "0 0 32px", maxWidth: "62ch", color: dim }}>
        Real citations still work: click any source tag to see the exact clause it was pulled from.
      </p>

      {/* Draggable icon cards */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
        {SAMPLE_CONTRACTS.map((c) => {
          const isActive = c.id === activeId;
          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              draggable="true"
              data-demo-contract-id={c.id}
              onDragStart={(e) => handleCardDragStart(e, c.id)}
              onClick={() => trigger(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  trigger(c.id);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "grab",
                userSelect: "none",
                border: `1px solid ${isActive ? "var(--color-accent)" : "var(--color-divider)"}`,
                background: isActive ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "transparent",
                padding: "8px 12px",
                fontSize: 12,
                transition: "all 200ms cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <FileGlyph small style={{ flex: "none", opacity: 0.7 }} />
              <span style={{ fontWeight: 600 }}>{c.shortLabel}</span>
              <span style={{ color: dim, fontFeatureSettings: "'tnum' 1" }}>{c.pages}p</span>
            </div>
          );
        })}
      </div>

      {/* Descriptive cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: "clamp(20px,2.5vw,32px)", marginBottom: 32 }}>
        {SAMPLE_CONTRACTS.map((c) => {
          const isActive = c.id === activeId;
          return (
            <div
              key={c.id}
              className="blueprint"
              style={{
                padding: 22,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                ...(isActive ? { borderColor: "var(--color-accent)", boxShadow: "inset 0 0 0 1px var(--color-accent)" } : {}),
              }}
            >
              <i className="corner tl" />
              <i className="corner tr" />
              <i className="corner bl" />
              <i className="corner br" />
              <span className="tag tag-outline" style={{ alignSelf: "flex-start" }}>{c.badge}</span>
              <h3 style={{ fontSize: 18, lineHeight: "24px", letterSpacing: "0.02em", textTransform: "uppercase", margin: "6px 0 0" }}>
                {c.title}
              </h3>
              <p style={{ fontSize: 14, lineHeight: "21px", margin: 0, color: dim70 }}>{c.description}</p>
              <span style={{ fontSize: 12, color: dim, fontFeatureSettings: "'tnum' 1" }}>{c.pages} pages</span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ marginTop: "auto", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 8 }}
                onClick={() => trigger(c.id)}
              >
                Try it <IconArrowRight size={14} opacity={0.8} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Drop zone */}
      <div
        className="blueprint"
        onDragOver={handleZoneDragOver}
        onDragLeave={handleZoneDragLeave}
        onDrop={handleZoneDrop}
        style={{
          background: "var(--color-bg)",
          border: isDropTarget ? "1px dashed var(--color-accent)" : undefined,
          transition: "border-color 150ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <i className="corner tl" />
        <i className="corner tr" />
        <i className="corner bl" />
        <i className="corner br" />
        <div style={{ display: "flex", minHeight: 180, flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 28px", textAlign: "center" }}>
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" onChange={handleFileFallback} style={{ display: "none" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, border: "1px solid var(--color-divider)", marginBottom: 16 }}>
            <IconUpload />
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 600, fontFamily: "var(--font-heading)", textTransform: "none", letterSpacing: 0, margin: 0 }}>
            Drop a PDF here
          </h3>
          <p style={{ marginTop: 6, maxWidth: 400, fontSize: 14, lineHeight: "21px", color: dim }}>
            Drag one of the samples above, or select one from your computer to see a sample scan.
          </p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => fileInputRef.current?.click()}>
            Select PDF
          </button>
        </div>
      </div>

      {/* Confirm card — simple, deliberately not a shared component. Shown
          once a sample is picked, before any scanning starts. */}
      {active && flowPhase === "confirm" && (
        <div ref={panelRef} className="blueprint" style={{ marginTop: 28, background: "var(--color-bg)", scrollMarginTop: 88 }}>
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
          <div style={{ display: "flex", minHeight: 180, flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "40px 28px", textAlign: "center" }}>
            <FileGlyph style={{ opacity: 0.7 }} />
            <div>
              <p style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>{active.filename}</p>
              <p style={{ fontSize: 13, margin: "4px 0 0", color: dim }}>{active.pages} pages</p>
            </div>
            <button type="button" className="btn btn-primary" style={{ marginTop: 4 }} onClick={startScan}>
              Scan
            </button>
          </div>
        </div>
      )}

      {/* Real scan loading screen, fed the sample's pre-generated step count
          instead of a live /api/analyze stream — same component, same
          checklist, just resolves on a short local timer. */}
      {active && flowPhase === "scanning" && (
        <div style={{ marginTop: 28 }}>
          <ScanningView
            fileName={active.filename}
            pageCount={active.pages}
            stepsDone={scanStepsDone}
            phase={scanPhase}
            onViewResults={viewResults}
          />
        </div>
      )}

      {/* Real results view, fed the sample's pre-generated analysis. */}
      {active && flowPhase === "results" && (
        <div style={{ marginTop: 28 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              padding: "12px 20px",
              border: "1px solid var(--color-divider)",
              borderBottom: "none",
              background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
            }}
          >
            <span className="tag tag-outline" style={{ gap: 6, display: "inline-flex", alignItems: "center" }}>
              <span style={{ width: 6, height: 6, background: "var(--color-accent)", flex: "none" }} />
              Sample analysis
            </span>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 13, padding: 0 }} onClick={backToPicker}>
              ← Try another sample
            </button>
          </div>
          <ResultsView
            analysis={active.analysis}
            fileName={active.filename}
            analyzedAt={analyzedAt}
            onOpenCitation={noop}
            onExportPdf={noop}
            onAskContract={noop}
          />
        </div>
      )}
    </section>
  );
}
