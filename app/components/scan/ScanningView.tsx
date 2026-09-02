"use client";

// The full-screen "scanning in progress" view shown between file upload and
// results — same "Industry" light theme as app/components/landing and
// app/components/results, imported from the same Scan Loading Screen.dc.html
// design and scoped under .ci-scan so it never leaks into the dark app shell.
//
// The checklist order below (identity -> dates -> terms -> clauses -> watch)
// must match PARTIAL_ANALYSIS_KEYS in app/page.tsx — that's the order Claude
// is asked to stream the analysis JSON's keys in (see app/api/analyze/
// route.ts's prompt), so `stepsDone` (how many of those keys have fully
// streamed in, counting from the front) drives which row is done/active/
// pending here.

import { CSSProperties } from "react";
import { IconCalendar, IconCheck, IconList } from "../landing/icons";
import { IconAlertTriangle, IconFile, IconFileCheck } from "../results/icons";
import "./scanning.css";

type StepStatus = "done" | "active" | "pending";
export type ScanPhase = "scanning" | "complete";

const SCAN_STEPS = [
  { label: "Contract identity", activeLabel: "Reading contract identity", Icon: IconFile },
  { label: "Important dates", activeLabel: "Extracting important dates", Icon: IconCalendar },
  { label: "Commercial terms", activeLabel: "Checking payment details", Icon: IconList },
  { label: "Key clauses", activeLabel: "Reviewing key clauses", Icon: IconFileCheck },
  { label: "Things to watch", activeLabel: "Flagging things to watch", Icon: IconAlertTriangle },
] as const;

interface ScanningViewProps {
  fileName: string;
  pageCount: number | null;
  /** How many leading checklist rows (in SCAN_STEPS order) have completed. */
  stepsDone: number;
  phase: ScanPhase;
  onViewResults: () => void;
}

function stepBadgeStyle(status: StepStatus): CSSProperties {
  const base: CSSProperties = {
    width: 34,
    height: 34,
    flex: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid",
    transition: "border-color 300ms ease, background-color 300ms ease, opacity 300ms ease",
  };
  if (status === "done") return { ...base, borderColor: "var(--color-accent)", background: "var(--color-accent-100)", opacity: 1 };
  if (status === "active") return { ...base, borderColor: "var(--color-accent)", background: "transparent", opacity: 1 };
  return { ...base, borderColor: "var(--color-divider)", background: "transparent", opacity: 0.5 };
}

function stepLabelStyle(status: StepStatus): CSSProperties {
  return {
    flex: 1,
    fontSize: 14,
    fontWeight: status === "active" ? 600 : 400,
    color: status === "pending" ? "color-mix(in srgb, var(--color-text) 55%, transparent)" : "var(--color-text)",
    transition: "color 300ms ease",
  };
}

export default function ScanningView({ fileName, pageCount, stepsDone, phase, onViewResults }: ScanningViewProps) {
  const phaseComplete = phase === "complete";
  const statuses: StepStatus[] = SCAN_STEPS.map((_, i) =>
    i < stepsDone ? "done" : i === stepsDone && !phaseComplete ? "active" : "pending"
  );

  const progressPercent = phaseComplete ? 100 : Math.round((stepsDone / SCAN_STEPS.length) * 100);
  const statusHeading = phaseComplete
    ? "Analysis complete"
    : stepsDone < SCAN_STEPS.length
      ? `${SCAN_STEPS[stepsDone].activeLabel}…`
      : "Finishing up…";
  const statusSubtext = phaseComplete ? "Your results are ready to view." : `Reading through ${fileName}.`;
  const progressLabel = phaseComplete ? "Complete" : `${stepsDone} of ${SCAN_STEPS.length} sections`;

  return (
    <div className="ci-scan" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--color-bg)", color: "var(--color-text)" }}>
      <nav className="nav" style={{ borderBottom: "1px solid var(--color-divider)" }}>
        {/* Plain <a>, not next/link — same reason as ResultsView's brand:
            this view is rendered inside the "/" route, so only a full load
            actually returns to the homepage. */}
        <a href="/" className="nav-brand" style={{ color: "var(--color-text)", textDecoration: "none" }}>
          Contract Intelligence
        </a>
      </nav>

      <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "56px 24px 64px" }}>
        <div style={{ width: "100%", maxWidth: 720, display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="blueprint" style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px" }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            <IconFile size={20} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>
                {fileName}
              </p>
              <p className="text-muted" style={{ fontSize: 12.5, margin: "2px 0 0" }}>
                {pageCount ? `${pageCount} pages · ` : ""}Uploaded just now
              </p>
            </div>
            <span className={`tag ${phaseComplete ? "tag-outline" : "tag-accent"}`}>{phaseComplete ? "Analyzed" : "Analyzing"}</span>
          </div>

          <div className="blueprint" style={{ padding: "56px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />

            <div
              className={`blueprint ${phaseComplete ? "" : "ci-scan-badge-pulsing"}`}
              style={{
                width: 64,
                height: 64,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderColor: "var(--color-accent)",
                background: phaseComplete ? "var(--color-accent-100)" : "transparent",
                flex: "none",
              }}
            >
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              {phaseComplete ? <IconCheck size={28} strokeWidth={1.5} /> : <IconFile size={26} />}
            </div>

            <h2 role="status" aria-live="polite" style={{ fontSize: 26, margin: "22px 0 0" }}>
              {statusHeading}
            </h2>
            <p className="text-muted" style={{ fontSize: 14, maxWidth: 420, margin: "6px 0 0" }}>
              {statusSubtext}
            </p>

            <div style={{ width: "100%", maxWidth: 420, marginTop: 32 }}>
              <div style={{ height: 6, background: "var(--color-divider)", position: "relative", overflow: "hidden" }}>
                <div style={{ height: "100%", background: "var(--color-accent)", width: `${progressPercent}%`, transition: "width 500ms cubic-bezier(0.4,0,0.2,1)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <span className="text-muted" style={{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase" }}>
                  Progress
                </span>
                <span className="text-muted" style={{ fontSize: 11, fontFeatureSettings: "'tnum' 1" }}>
                  {progressLabel}
                </span>
              </div>
            </div>

            <div style={{ width: "100%", maxWidth: 420, marginTop: 32, display: "flex", flexDirection: "column", textAlign: "left" }}>
              {SCAN_STEPS.map((step, i) => {
                const status = statuses[i];
                const StepIcon = step.Icon;
                return (
                  <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 4px" }}>
                    <div style={stepBadgeStyle(status)}>
                      <StepIcon size={17} />
                    </div>
                    <span style={stepLabelStyle(status)}>{step.label}</span>
                    <div style={{ width: 16, height: 16, flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {status === "done" && <IconCheck size={14} strokeWidth={2} />}
                      {status === "active" && (
                        <span style={{ display: "inline-block", width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--color-divider)", borderTopColor: "var(--color-accent)", animation: "ci-scan-spin 700ms linear infinite" }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {phaseComplete && (
              <button type="button" className="btn btn-primary" style={{ marginTop: 32 }} onClick={onViewResults}>
                View results
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
