"use client";

// Standalone "pick a sample contract" section. Visitors choose one of 3
// pre-generated sample contracts (dragging its icon card onto the drop zone,
// clicking "Try it →", or the "Select PDF" fallback) and watch the *real*
// scan-to-results screens run against pre-generated data:
//
//   confirm card (ConfirmCard) -> ScanningView -> ResultsView
//
// Same three components the real upload flow uses (app/page.tsx) — reused
// as-is, not recreated. The only things faked are the timing (ScanningView's
// stepsDone/phase are driven by a local timer, never a real analyze call)
// and the source document (ResultsView's citations open a small "here's the
// quoted clause" modal instead of a real PDF page, since there's no real
// file). ResultsView's own "Sample analysis" badge and "← Try another
// sample" link (both optional props it now takes) make the difference from
// a real scan obvious throughout.
//
// Nothing here ever reads a real file. The drag mechanism only recognizes
// the icon cards' own custom dataTransfer type — a real file dragged onto
// the drop zone carries no data of that type, so dragOver never calls
// preventDefault and the drop falls through to the browser's default
// (do-nothing-useful) handling. The "Select PDF" fallback opens a real
// native file picker purely as a familiar click-based trigger gesture:
// whatever file is chosen is discarded unread, and the active sample's
// pre-generated data plays regardless.
//
// While a sample is running (confirm/scanning/results), those three screens
// take over the full viewport (position: fixed, same full-page layouts
// ScanningView/ResultsView already use) rather than appearing inline in this
// section — matching how the real flow replaces the whole page rather than
// growing a panel inline. "← Try another sample" (or closing the confirm
// screen) drops back to the picker below.

import { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { DemoContract, SAMPLE_CONTRACTS } from "./sampleContracts";
import { IconArrowRight, IconUpload } from "./icons";
import ConfirmCard from "./ConfirmCard";
import ScanningView, { ScanPhase } from "../scan/ScanningView";
import ResultsView from "../results/ResultsView";

// Custom dataTransfer type used for the sample-card drag. Deliberately
// namespaced and non-standard so it can never collide with a real file
// drag, which reports the standard "Files" type instead.
const SAMPLE_DRAG_TYPE = "application/x-ci-sample-contract-id";

// Must match ScanningView's own SCAN_STEPS.length (5) — not exported from
// there, so kept in sync here by hand.
const SCAN_STEP_COUNT = 5;

type FlowStep = "picker" | "confirm" | "scanning" | "results";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function FileGlyph({ small }: { small?: boolean }) {
  const size = small ? 10 : 15;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", opacity: 0.7 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

// A minimal nav bar matching ScanningView/ResultsView's own, shown above the
// confirm screen so the full-viewport takeover doesn't look like a bare box.
function TakeoverNav({ onClose }: { onClose: () => void }) {
  return (
    <nav className="nav" style={{ borderBottom: "1px solid var(--color-divider)" }}>
      <span className="nav-brand">Contract Intelligence</span>
      <button type="button" className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onClose}>
        ← Back to samples
      </button>
    </nav>
  );
}

interface CitationState {
  page: number | null;
  section: string | null;
  quote: string | null;
}

export default function SampleScanSection() {
  const [step, setStep] = useState<FlowStep>("picker");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [stepsDone, setStepsDone] = useState(0);
  const [phase, setPhase] = useState<ScanPhase>("scanning");
  const [analyzedAt, setAnalyzedAt] = useState<Date | null>(null);
  const [citation, setCitation] = useState<CitationState | null>(null);
  const [askNoticeOpen, setAskNoticeOpen] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active: DemoContract | null = activeId ? SAMPLE_CONTRACTS.find((c) => c.id === activeId) ?? null : null;

  const dim = "color-mix(in srgb, var(--color-text) 55%, transparent)";
  const dim70 = "color-mix(in srgb, var(--color-text) 78%, transparent)";

  const pick = (id: string) => {
    setActiveId(id);
    setStep("confirm");
  };

  const startScanning = () => {
    setStepsDone(0);
    setPhase("scanning");
    setStep("scanning");
  };

  const viewResults = () => {
    setAnalyzedAt(new Date());
    setStep("results");
  };

  const backToPicker = () => {
    setStep("picker");
    setActiveId(null);
    setCitation(null);
    setAskNoticeOpen(false);
    requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // Drives ScanningView's stepsDone/phase on a fixed timer — never a real
  // /api/analyze call. Only setTimeout callbacks touch state here; the reset
  // to stepsDone=0/phase="scanning" happens synchronously in startScanning
  // above, not in this effect body.
  useEffect(() => {
    if (step !== "scanning" || !active) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= SCAN_STEP_COUNT; i++) {
      timers.push(setTimeout(() => setStepsDone(i), i * 450));
    }
    timers.push(setTimeout(() => setPhase("complete"), SCAN_STEP_COUNT * 450 + 400));
    return () => timers.forEach(clearTimeout);
    // `active` is a stable reference from the module-level SAMPLE_CONTRACTS
    // array (only its identity, tied to activeId, matters here), so this is
    // safe to include without causing extra re-runs.
  }, [step, activeId, active]);

  const handleCardDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    e.dataTransfer.setData(SAMPLE_DRAG_TYPE, id);
    e.dataTransfer.effectAllowed = "copy";
  };

  // Only ever inspects our own custom type. A real file drag reports type
  // "Files", never SAMPLE_DRAG_TYPE, so this intentionally does nothing for
  // it — no preventDefault, no drop handler fires, browser default applies.
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
    pick(e.dataTransfer.getData(SAMPLE_DRAG_TYPE));
  };

  // Whatever file the visitor picks here is never read — this button is a
  // click-based fallback to dragging, not a real upload. It just launches
  // the sample scan for the currently active (or first) contract.
  const handleFileFallback = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = "";
    pick(activeId ?? SAMPLE_CONTRACTS[0].id);
  };

  const openCitation = (page: number, section: string | null, quote: string | null) => setCitation({ page, section, quote });

  return (
    <section ref={sectionRef} id="sample-scan" data-screen-label="Sample scan" style={{ padding: "88px 0 32px" }}>
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
        {SAMPLE_CONTRACTS.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            draggable="true"
            data-demo-contract-id={c.id}
            onDragStart={(e) => handleCardDragStart(e, c.id)}
            onClick={() => pick(c.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                pick(c.id);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "grab",
              userSelect: "none",
              border: "1px solid var(--color-divider)",
              background: "transparent",
              padding: "8px 12px",
              fontSize: 12,
              transition: "all 200ms cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            <FileGlyph small />
            <span style={{ fontWeight: 600 }}>{c.shortLabel}</span>
            <span style={{ color: dim, fontFeatureSettings: "'tnum' 1" }}>{c.pages}p</span>
          </div>
        ))}
      </div>

      {/* Descriptive cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: "clamp(20px,2.5vw,32px)", marginBottom: 32 }}>
        {SAMPLE_CONTRACTS.map((c) => (
          <div key={c.id} className="blueprint" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
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
              onClick={() => pick(c.id)}
            >
              Try it <IconArrowRight size={14} opacity={0.8} />
            </button>
          </div>
        ))}
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

      {/* Full-viewport takeover for confirm / scanning / results — mirrors
          the real flow's whole-page swap instead of growing inline. */}
      {active && step !== "picker" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, overflowY: "auto", background: "var(--color-bg)" }}>
          {step === "confirm" && (
            <div className="ci-scan" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bg)", color: "var(--color-text)" }}>
              <TakeoverNav onClose={backToPicker} />
              <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "56px 24px 64px" }}>
                <div style={{ width: "100%", maxWidth: 480 }}>
                  <div className="blueprint" style={{ background: "var(--color-bg)" }}>
                    <i className="corner tl" />
                    <i className="corner tr" />
                    <i className="corner bl" />
                    <i className="corner br" />
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 28px", textAlign: "center" }}>
                      <ConfirmCard
                        fileName={active.filename}
                        fileSizeLabel={formatFileSize(active.fileSizeBytes)}
                        onContinue={startScanning}
                        continueLabel="Scan this contract"
                        secondaryActions={[{ label: "Choose a different sample", onClick: backToPicker }]}
                      />
                    </div>
                  </div>
                </div>
              </main>
            </div>
          )}

          {step === "scanning" && (
            <ScanningView fileName={active.filename} pageCount={active.pages} stepsDone={stepsDone} phase={phase} onViewResults={viewResults} />
          )}

          {step === "results" && (
            <ResultsView
              analysis={active.analysis}
              fileName={active.filename}
              analyzedAt={analyzedAt}
              onOpenCitation={openCitation}
              onExportPdf={() => window.print()}
              onAskContract={() => setAskNoticeOpen(true)}
              badge="Sample analysis"
              backLink={{ label: "Try another sample", onClick: backToPicker }}
            />
          )}

          {citation && (
            <div
              role="presentation"
              onClick={() => setCitation(null)}
              style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: "32px 16px" }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Source"
                onClick={(e) => e.stopPropagation()}
                className="card blueprint"
                style={{ width: "100%", maxWidth: 440, padding: 20, background: "var(--color-bg)" }}
              >
                <i className="corner tl" />
                <i className="corner tr" />
                <i className="corner bl" />
                <i className="corner br" />
                <p className="card-kicker" style={{ margin: 0 }}>
                  {[citation.section, citation.page ? `Page ${citation.page}` : null].filter(Boolean).join(" · ") || "Source"}
                </p>
                {citation.quote ? (
                  <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.6, fontStyle: "italic" }}>“{citation.quote}”</p>
                ) : (
                  <p className="text-muted" style={{ margin: "10px 0 0", fontSize: 13.5 }}>No exact clause text was pinpointed for this item.</p>
                )}
                <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setCitation(null)}>
                  Got it
                </button>
              </div>
            </div>
          )}

          {askNoticeOpen && (
            <div
              role="presentation"
              onClick={() => setAskNoticeOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: "32px 16px" }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Ask your contract unavailable"
                onClick={(e) => e.stopPropagation()}
                className="card blueprint"
                style={{ width: "100%", maxWidth: 380, padding: 20, textAlign: "center", background: "var(--color-bg)" }}
              >
                <i className="corner tl" />
                <i className="corner tr" />
                <i className="corner bl" />
                <i className="corner br" />
                <p style={{ fontWeight: 600, fontSize: 15 }}>Not available for sample contracts</p>
                <p className="text-muted" style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.55 }}>
                  Ask Your Contract needs a real document to answer from. Scan one of your own to try it.
                </p>
                <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setAskNoticeOpen(false)}>
                  Got it
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
