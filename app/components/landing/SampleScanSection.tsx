"use client";

// Standalone "pick a sample contract" section — a deliberate, user-triggered
// demo, separate from HeroDemo's ambient hero illustration above. Visitors
// choose one of 3 pre-generated sample contracts (by dragging its icon card
// onto the drop zone, clicking "Try it →", or using the "Select PDF"
// fallback) to watch the full scan-to-results experience play out below.
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

import { CSSProperties, ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { DemoContract, SAMPLE_CONTRACTS } from "./sampleContracts";
import { IconArrowRight, IconUpload } from "./icons";

const STEP_LABELS = ["01 Upload", "02 Scan", "03 Extract", "04 Ask"];

// Custom dataTransfer type used for the sample-card drag. Deliberately
// namespaced and non-standard so it can never collide with a real file
// drag, which reports the standard "Files" type instead.
const SAMPLE_DRAG_TYPE = "application/x-ci-sample-contract-id";

interface DemoState {
  step: number;
  file: boolean;
  scanPage: number;
  done: boolean;
  nf: number;
  typed: number;
  thinking: boolean;
  answer: boolean;
  acite: boolean;
}

function freshState(): DemoState {
  return { step: 0, file: false, scanPage: 0, done: false, nf: 0, typed: 0, thinking: false, answer: false, acite: false };
}

function finalState(contract: DemoContract): DemoState {
  return {
    step: 3,
    file: true,
    scanPage: contract.pages,
    done: true,
    nf: contract.fields.length,
    typed: contract.askQ.length,
    thinking: false,
    answer: true,
    acite: true,
  };
}

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

export default function SampleScanSection() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [session, setSession] = useState(0);
  const [demo, setDemo] = useState<DemoState>(freshState());
  const [isDropTarget, setIsDropTarget] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = activeId ? SAMPLE_CONTRACTS.find((c) => c.id === activeId) ?? null : null;

  const dim = "color-mix(in srgb, var(--color-text) 55%, transparent)";
  const dim70 = "color-mix(in srgb, var(--color-text) 78%, transparent)";

  // Selecting (or re-selecting) a sample bumps `session` so the effect below
  // always restarts the playback, even when the visitor triggers the same
  // contract twice in a row. The initial demo state (fresh vs. already-final
  // for reduced motion) is decided here, synchronously with the click/drop,
  // rather than inside the effect.
  const trigger = (id: string) => {
    const contract = SAMPLE_CONTRACTS.find((c) => c.id === id);
    if (!contract) return;
    setActiveId(id);
    setDemo(prefersReducedMotion() ? finalState(contract) : freshState());
    setSession((s) => s + 1);
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  useEffect(() => {
    if (!active || prefersReducedMotion()) return;

    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    clear();

    const schedule = (delay: number, patch: Partial<DemoState>) => {
      timers.current.push(setTimeout(() => setDemo((s) => ({ ...s, ...patch })), delay));
    };

    const scanPages = active.pages;
    const fields = active.fields;
    const askQ = active.askQ;

    schedule(300, { file: true });
    schedule(800, { step: 1 });
    for (let p = 1; p <= scanPages; p++) schedule(800 + p * 32, { scanPage: p });
    const scanEnd = 800 + scanPages * 32;
    schedule(scanEnd + 200, { done: true, step: 2 });
    for (let i = 1; i <= fields.length; i++) schedule(scanEnd + 400 + i * 380, { nf: i });
    const fieldsEnd = scanEnd + 400 + fields.length * 380;
    schedule(fieldsEnd + 500, { step: 3 });
    for (let i = 1; i <= askQ.length; i++) schedule(fieldsEnd + 700 + i * 26, { typed: i });
    const typedEnd = fieldsEnd + 700 + askQ.length * 26;
    schedule(typedEnd + 250, { thinking: true });
    schedule(typedEnd + 1350, { thinking: false, answer: true });
    schedule(typedEnd + 1700, { acite: true });

    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, session]);

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
    trigger(e.dataTransfer.getData(SAMPLE_DRAG_TYPE));
  };

  // Whatever file the visitor picks here is never read — this button is a
  // click-based fallback to dragging, not a real upload. It just launches
  // the sample scan for the currently active (or first) contract.
  const handleFileFallback = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = "";
    trigger(activeId ?? SAMPLE_CONTRACTS[0].id);
  };

  const scanCaption = active && demo.done ? "Analysis" : demo.step >= 1 ? "Scanning" : "Uploading";
  const scanLabel =
    active &&
    (demo.done
      ? "Scan complete — analyzed in 2.8s"
      : demo.step >= 1
        ? `Scanning page ${demo.scanPage} of ${active.pages}…`
        : "Uploading…");
  const scanPct = active ? Math.round((demo.scanPage / active.pages) * 100) : 0;
  const statusLabel = demo.done ? "Analyzed" : demo.file ? "Processing" : "Ready";
  const caretOn = active != null && demo.step >= 3 && demo.typed < active.askQ.length;

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

      {/* Scan / results playback */}
      {active && (
        <div ref={panelRef} className="blueprint" style={{ marginTop: 28, background: "var(--color-bg)", scrollMarginTop: 88 }}>
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              borderBottom: "1px solid var(--color-divider)",
              padding: "12px 20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <FileGlyph style={{ flex: "none", opacity: 0.6 }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>{active.filename}</span>
              <span style={{ fontSize: 12, color: dim, fontFeatureSettings: "'tnum' 1" }}>{active.pages} pages</span>
            </div>
            <span className="tag tag-outline" style={{ gap: 6, display: "inline-flex", alignItems: "center" }}>
              <span style={{ width: 6, height: 6, background: "var(--color-accent)", flex: "none" }} />
              {statusLabel}
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "14px 20px", borderBottom: "1px solid var(--color-divider)" }}>
            {STEP_LABELS.map((label, i) => {
              const on = demo.step >= i && demo.file;
              const cur = demo.step === i && demo.file;
              const ink = on ? (cur ? "var(--color-accent-700)" : "var(--color-text)") : dim;
              const bc = cur ? "var(--color-accent)" : "var(--color-divider)";
              const bg = cur ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "transparent";
              return (
                <span
                  key={label}
                  style={{
                    fontSize: 12,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    padding: "5px 12px",
                    border: `1px solid ${bc}`,
                    color: ink,
                    background: bg,
                    transition: "all 250ms cubic-bezier(0.4,0,0.2,1)",
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>

          <div style={{ padding: "22px 20px 26px", minHeight: 340 }}>
            {demo.file && (
              <div className="ci-fade">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: dim }}>
                    {scanCaption}
                  </span>
                  <span style={{ fontSize: 12, color: "color-mix(in srgb, var(--color-text) 70%, transparent)", fontFeatureSettings: "'tnum' 1" }}>
                    {scanLabel}
                  </span>
                </div>
                <div style={{ height: 2, background: "color-mix(in srgb, var(--color-text) 10%, transparent)", marginBottom: 24 }}>
                  <div style={{ height: "100%", background: "var(--color-accent)", width: `${scanPct}%`, transition: "width 60ms linear" }} />
                </div>
              </div>
            )}

            {active.fields.slice(0, demo.nf).map((f) => (
              <div key={f.l} className="ci-fade" style={{ padding: "12px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: dim }}>
                    {f.l}
                  </span>
                  <span
                    className="ci-pop"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      border: "1px solid var(--color-divider)",
                      padding: "2px 8px",
                      fontSize: 11,
                      color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
                      maxWidth: "100%",
                    }}
                  >
                    <FileGlyph small style={{ flex: "none", opacity: 0.7 }} />
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.c}</span>
                  </span>
                </div>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 19, lineHeight: 1.25, overflowWrap: "break-word" }}>
                  {f.v}
                </span>
              </div>
            ))}

            {demo.step >= 3 && (
              <div className="ci-fade" style={{ marginTop: 22 }}>
                <span style={{ display: "block", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: dim, marginBottom: 10 }}>
                  Ask your contract
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid var(--color-divider)", padding: "11px 14px" }}>
                  <span style={{ width: 6, height: 6, background: "var(--color-accent)", flex: "none" }} />
                  <span style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{active.askQ.slice(0, demo.typed)}</span>
                  {caretOn && <span className="ci-caret" style={{ display: "inline-block", width: 2, height: 15, background: "var(--color-text)" }} />}
                </div>
                {demo.thinking && <p style={{ margin: "12px 2px 0", fontSize: 13, color: dim }}>Reading the document…</p>}
                {demo.answer && (
                  <div className="ci-fade" style={{ marginTop: 12, border: "1px solid var(--color-divider)", padding: "14px 16px" }}>
                    <p style={{ margin: 0, fontSize: 14, lineHeight: "22px" }}>{active.answerText}</p>
                    {demo.acite && (
                      <span
                        className="ci-pop"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          border: "1px solid var(--color-divider)",
                          padding: "2px 8px",
                          fontSize: 11,
                          color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
                          marginTop: 10,
                        }}
                      >
                        <FileGlyph small style={{ flex: "none", opacity: 0.7 }} />
                        {active.answerCite}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
