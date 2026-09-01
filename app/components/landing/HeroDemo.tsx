"use client";

// Purely illustrative autoplay loop for the hero — mirrors the imported
// Landing.dc.html design's timed reveal exactly (same delays/durations), but
// as plain React state instead of the design canvas's DCLogic runtime. Not
// wired to any real upload; the real dropzone lives in UploadPanel below.

import { CSSProperties, useEffect, useRef, useState } from "react";

const FIELDS = [
  { l: "Renewal date", v: "14 Aug 2027", c: "§9.1" },
  { l: "Notice period", v: "90 days", c: "§9.1" },
  { l: "Renewal term", v: "Two (2) years commencing on expiry of the Initial Term", c: "Item 13, Special Condition 1,4" },
  { l: "Auto-renewal", v: "Yes — renews automatically", c: "Page 2" },
];
const STEP_LABELS = ["01 Upload", "02 Scan", "03 Extract", "04 Ask"];
const ASK_Q = "What happens if we terminate early?";
const SCAN_PAGES = 38;
const ANSWER_TEXT =
  "Early termination requires 60 days’ written notice and payment of the remaining minimum-commitment fees for the current term.";
const ANSWER_CITE = "Section 11.2, Early Termination";

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

const FRESH: DemoState = {
  step: 0,
  file: false,
  scanPage: 0,
  done: false,
  nf: 0,
  typed: 0,
  thinking: false,
  answer: false,
  acite: false,
};

const FINAL: DemoState = {
  step: 3,
  file: true,
  scanPage: SCAN_PAGES,
  done: true,
  nf: FIELDS.length,
  typed: ASK_Q.length,
  thinking: false,
  answer: true,
  acite: true,
};

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
  const [demo, setDemo] = useState<DemoState>(() => (prefersReducedMotion() ? FINAL : FRESH));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const clear = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    const play = () => {
      clear();
      const schedule = (delay: number, patch: Partial<DemoState>) => {
        timers.current.push(setTimeout(() => setDemo((s) => ({ ...s, ...patch })), delay));
      };

      schedule(300, { file: true });
      schedule(800, { step: 1 });
      for (let p = 1; p <= SCAN_PAGES; p++) schedule(800 + p * 32, { scanPage: p });
      const scanEnd = 800 + SCAN_PAGES * 32;
      schedule(scanEnd + 200, { done: true, step: 2 });
      for (let i = 1; i <= FIELDS.length; i++) schedule(scanEnd + 400 + i * 380, { nf: i });
      const fieldsEnd = scanEnd + 400 + FIELDS.length * 380;
      schedule(fieldsEnd + 500, { step: 3 });
      for (let i = 1; i <= ASK_Q.length; i++) schedule(fieldsEnd + 700 + i * 26, { typed: i });
      const typedEnd = fieldsEnd + 700 + ASK_Q.length * 26;
      schedule(typedEnd + 250, { thinking: true });
      schedule(typedEnd + 1350, { thinking: false, answer: true });
      schedule(typedEnd + 1700, { acite: true });
      timers.current.push(
        setTimeout(() => {
          setDemo(FRESH);
          play();
        }, typedEnd + 5200)
      );
    };

    play();
    return clear;
  }, []);

  const dim = "color-mix(in srgb, var(--color-text) 55%, transparent)";
  const scanCaption = demo.done ? "Analysis" : demo.step >= 1 ? "Scanning" : "Uploading";
  const scanLabel = demo.done
    ? "Scan complete — analyzed in 2.8s"
    : demo.step >= 1
      ? `Scanning page ${demo.scanPage} of ${SCAN_PAGES}…`
      : "Uploading…";
  const scanPct = Math.round((demo.scanPage / SCAN_PAGES) * 100);
  const statusLabel = demo.done ? "Analyzed" : demo.file ? "Processing" : "Ready";
  const caretOn = demo.step >= 3 && demo.typed < ASK_Q.length;

  return (
    <div className="blueprint" style={{ marginTop: 64, background: "var(--color-bg)" }}>
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
          <span style={{ fontSize: 13, fontWeight: 600 }}>MSA_Vendor_Services.pdf</span>
          <span style={{ fontSize: 12, color: dim, fontFeatureSettings: "'tnum' 1" }}>38 pages</span>
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

        {FIELDS.slice(0, demo.nf).map((f) => (
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
              <span style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{ASK_Q.slice(0, demo.typed)}</span>
              {caretOn && (
                <span className="ci-caret" style={{ display: "inline-block", width: 2, height: 15, background: "var(--color-text)" }} />
              )}
            </div>
            {demo.thinking && <p style={{ margin: "12px 2px 0", fontSize: 13, color: dim }}>Reading the document…</p>}
            {demo.answer && (
              <div className="ci-fade" style={{ marginTop: 12, border: "1px solid var(--color-divider)", padding: "14px 16px" }}>
                <p style={{ margin: 0, fontSize: 14, lineHeight: "22px" }}>{ANSWER_TEXT}</p>
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
                    {ANSWER_CITE}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
