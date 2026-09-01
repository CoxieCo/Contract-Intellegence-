"use client";

// Purely illustrative autoplay loop for the hero — mirrors the imported
// Landing.dc.html design's timed reveal exactly (same delays/durations), but
// as plain React state instead of the design canvas's DCLogic runtime. Not
// wired to any real upload; the real dropzone lives in UploadPanel below.
//
// Visitors can also pick which of the 3 sample contracts plays, either by
// clicking a card or by dragging one onto the panel below. That drag is
// internal-only: cards carry their contract id via a custom dataTransfer
// type, and the panel's handlers read only that — never
// event.dataTransfer.files. This is a separate mechanism from the real
// scanner's file drop in UploadPanel; it must never be extended to accept
// an actual file from the visitor's computer. A real file dragged here
// carries no data of our custom type, so dragOver never calls
// preventDefault and the drop falls through to the browser's default
// (do-nothing-useful) handling, which is the desired outcome.

import { CSSProperties, DragEvent, useEffect, useRef, useState } from "react";
import { DemoContract, SAMPLE_CONTRACTS } from "./sampleContracts";

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

export default function HeroDemo() {
  const [selectedId, setSelectedId] = useState(SAMPLE_CONTRACTS[0].id);
  const selected = SAMPLE_CONTRACTS.find((c) => c.id === selectedId) ?? SAMPLE_CONTRACTS[0];
  const [demo, setDemo] = useState<DemoState>(() => (prefersReducedMotion() ? finalState(selected) : freshState()));
  const [isDropTarget, setIsDropTarget] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    // Reduced-motion visitors get the finished state directly from
    // selectContract below, with nothing left to animate here.
    if (prefersReducedMotion()) return;

    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    const play = () => {
      clear();
      setDemo(freshState());

      const schedule = (delay: number, patch: Partial<DemoState>) => {
        timers.current.push(setTimeout(() => setDemo((s) => ({ ...s, ...patch })), delay));
      };

      const scanPages = selected.pages;
      const fields = selected.fields;
      const askQ = selected.askQ;

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
      timers.current.push(setTimeout(play, typedEnd + 5200));
    };

    play();
    return clear;
  }, [selected]);

  const selectContract = (id: string) => {
    if (id === selectedId) return;
    const contract = SAMPLE_CONTRACTS.find((c) => c.id === id);
    if (!contract) return;
    setSelectedId(id);
    if (prefersReducedMotion()) setDemo(finalState(contract));
  };

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
    selectContract(e.dataTransfer.getData(SAMPLE_DRAG_TYPE));
  };

  const dim = "color-mix(in srgb, var(--color-text) 55%, transparent)";
  const scanCaption = demo.done ? "Analysis" : demo.step >= 1 ? "Scanning" : "Uploading";
  const scanLabel = demo.done
    ? "Scan complete — analyzed in 2.8s"
    : demo.step >= 1
      ? `Scanning page ${demo.scanPage} of ${selected.pages}…`
      : "Uploading…";
  const scanPct = Math.round((demo.scanPage / selected.pages) * 100);
  const statusLabel = demo.done ? "Analyzed" : demo.file ? "Processing" : "Ready";
  const caretOn = demo.step >= 3 && demo.typed < selected.askQ.length;

  return (
    <div style={{ marginTop: 64 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: dim }}>
          Try a sample contract
        </span>
        <span style={{ fontSize: 12, color: dim }}>Drag a card onto the panel, or click one</span>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {SAMPLE_CONTRACTS.map((c) => {
          const active = c.id === selectedId;
          return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              draggable="true"
              data-demo-contract-id={c.id}
              onDragStart={(e) => handleCardDragStart(e, c.id)}
              onClick={() => selectContract(c.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectContract(c.id);
                }
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "grab",
                userSelect: "none",
                border: `1px solid ${active ? "var(--color-accent)" : "var(--color-divider)"}`,
                background: active ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "transparent",
                padding: "8px 12px",
                fontSize: 12,
                transition: "all 200ms cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <FileGlyph small style={{ flex: "none", opacity: 0.7 }} />
              <span style={{ fontWeight: 600 }}>{c.filename}</span>
              <span style={{ color: dim, fontFeatureSettings: "'tnum' 1" }}>{c.pages}p</span>
            </div>
          );
        })}
      </div>

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
            <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.filename}</span>
            <span style={{ fontSize: 12, color: dim, fontFeatureSettings: "'tnum' 1" }}>{selected.pages} pages</span>
          </div>
          <span className="tag tag-outline" style={{ gap: 6, display: "inline-flex", alignItems: "center" }}>
            <span style={{ width: 6, height: 6, background: "var(--color-accent)", flex: "none" }} />
            {statusLabel}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            padding: "14px 20px",
            borderBottom: "1px solid var(--color-divider)",
          }}
        >
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 10,
                }}
              >
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

          {selected.fields.slice(0, demo.nf).map((f) => (
            <div key={f.l} className="ci-fade" style={{ padding: "12px 0", borderBottom: "1px solid var(--color-divider)" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 4,
                }}
              >
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
                <span style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{selected.askQ.slice(0, demo.typed)}</span>
                {caretOn && (
                  <span className="ci-caret" style={{ display: "inline-block", width: 2, height: 15, background: "var(--color-text)" }} />
                )}
              </div>
              {demo.thinking && <p style={{ margin: "12px 2px 0", fontSize: 13, color: dim }}>Reading the document…</p>}
              {demo.answer && (
                <div className="ci-fade" style={{ marginTop: 12, border: "1px solid var(--color-divider)", padding: "14px 16px" }}>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: "22px" }}>{selected.answerText}</p>
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
                      {selected.answerCite}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
