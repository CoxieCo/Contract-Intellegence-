"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ContractAnalysis,
  CURRENT_ANALYSIS_STORAGE_KEY,
  CurrentAnalysisSession,
  ThingToWatch,
  VIEW_REQUEST_STORAGE_KEY,
  severityRank,
} from "@/lib/contract-analysis";
import "../components/results/results.css";

interface StoredAnalysis {
  id: string;
  created_at: string;
  file_name: string;
  analysis: ContractAnalysis;
}

// ---------- Severity treatment — same tokens/pattern as results/WatchCard.tsx ----------

const SEVERITY_TAG_CLASS: Record<ThingToWatch["severity"], string> = {
  HIGH: "tag tag-outline",
  MEDIUM: "tag tag-accent",
  LOW: "tag tag-neutral",
};

const SEVERITY_DOT: Record<ThingToWatch["severity"], string> = {
  HIGH: "var(--color-accent-800)",
  MEDIUM: "var(--color-accent-500)",
  LOW: "var(--color-neutral-500)",
};

const SEVERITY_BORDER: Record<ThingToWatch["severity"], string> = {
  HIGH: "var(--color-accent-700)",
  MEDIUM: "var(--color-divider)",
  LOW: "var(--color-divider)",
};

function zoneTone(items: { severity: ThingToWatch["severity"] }[]) {
  const hasHigh = items.some((i) => i.severity === "HIGH");
  const hasMedium = items.some((i) => i.severity === "MEDIUM");
  if (hasHigh) return { border: "var(--color-accent-700)", label: "var(--color-accent-800)" };
  if (hasMedium) return { border: "var(--color-accent-500)", label: "var(--color-accent-700)" };
  return { border: "var(--color-divider)", label: "var(--color-text)" };
}

function LightSpinner() {
  return (
    <span
      className="animate-spin"
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: "2px solid var(--color-divider)",
        borderTopColor: "var(--color-accent-700)",
      }}
    />
  );
}

// ---------- Helpers ----------

function contractLabel(analysis: ContractAnalysis, fallback: string): string {
  const parties = analysis.contractOverview?.parties?.value;
  if (parties && parties !== "Not found") return parties;
  const name = analysis.contractOverview?.contractName?.value;
  if (name && name !== "Not found") return name;
  return fallback;
}

function relativeTime(dateString: string): string {
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return "recently";

  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

// HIGH item if there is one, else MEDIUM, else null — the single line a
// compact card has room for.
function topWatchPreview(items: ThingToWatch[] | undefined): ThingToWatch | null {
  if (!items || items.length === 0) return null;
  return items.find((i) => i.severity === "HIGH") ?? items.find((i) => i.severity === "MEDIUM") ?? null;
}

function severityCounts(items: ThingToWatch[] | undefined) {
  return {
    high: items?.filter((i) => i.severity === "HIGH").length ?? 0,
    medium: items?.filter((i) => i.severity === "MEDIUM").length ?? 0,
    low: items?.filter((i) => i.severity === "LOW").length ?? 0,
  };
}

interface DeadlineHit {
  dateValue: string;
  label: string;
}

// Scans renewal date + notice deadline across every stored analysis for the
// nearest one that's still in the future.
function findNearestDeadline(rows: StoredAnalysis[]): DeadlineHit | null {
  const now = Date.now();
  let best: (DeadlineHit & { timestamp: number }) | null = null;

  for (const row of rows) {
    const dates = row.analysis.importantDates;
    if (!dates) continue;
    const label = contractLabel(row.analysis, row.file_name);

    const candidates: { field: { value: string }; verb: string }[] = [
      { field: dates.noticeDeadline, verb: "notice window closes" },
      { field: dates.renewalDate, verb: "renews" },
    ];

    for (const { field, verb } of candidates) {
      if (!field || field.value === "Not found") continue;
      const timestamp = Date.parse(field.value);
      if (Number.isNaN(timestamp) || timestamp < now) continue;
      if (!best || timestamp < best.timestamp) {
        best = { timestamp, dateValue: field.value, label: `${label} ${verb}` };
      }
    }
  }

  return best;
}

interface RollupItem extends ThingToWatch {
  contractLabel: string;
  contractType: string;
}

// Every HIGH/MEDIUM item across every stored analysis, sorted HIGH first.
function buildRollup(rows: StoredAnalysis[]): RollupItem[] {
  const items: RollupItem[] = [];
  for (const row of rows) {
    const label = contractLabel(row.analysis, row.file_name);
    const type = row.analysis.contractOverview?.contractType?.value ?? "";
    for (const item of row.analysis.thingsToWatch ?? []) {
      if (item.severity === "HIGH" || item.severity === "MEDIUM") {
        items.push({ ...item, contractLabel: label, contractType: type !== "Not found" ? type : "" });
      }
    }
  }
  return items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

function formatCitation(section: string | null): string | null {
  if (!section) return null;
  return section.replace(/^section\s+/i, "§");
}

function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );
}

// ---------- Page ----------

export default function DashboardPage() {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<StoredAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // sessionStorage only exists client-side; useSyncExternalStore is React's
  // sanctioned way to read an external, browser-only store like this without
  // a hydration mismatch (getServerSnapshot below matches what the server
  // renders — nothing — until the client's real snapshot takes over).
  const currentSessionRaw = useSyncExternalStore(
    () => () => {},
    () => sessionStorage.getItem(CURRENT_ANALYSIS_STORAGE_KEY),
    () => null
  );
  const currentSession = useMemo<CurrentAnalysisSession | null>(() => {
    if (!currentSessionRaw) return null;
    try {
      return JSON.parse(currentSessionRaw) as CurrentAnalysisSession;
    } catch {
      return null;
    }
  }, [currentSessionRaw]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/analyses");
        const data = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(data.error || "Failed to load analyses");
          return;
        }
        if (!cancelled) setAnalyses(Array.isArray(data.analyses) ? data.analyses : []);
      } catch {
        if (!cancelled) setError("Couldn't reach the analyses service. Is the dev server running?");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const totalCount = analyses.length;
  const crossHighCount = useMemo(
    () => analyses.reduce((sum, row) => sum + (row.analysis.thingsToWatch?.filter((w) => w.severity === "HIGH").length ?? 0), 0),
    [analyses]
  );
  const nearestDeadline = useMemo(() => findNearestDeadline(analyses), [analyses]);
  const rollup = useMemo(() => buildRollup(analyses), [analyses]);
  const rollupHighCount = rollup.filter((i) => i.severity === "HIGH").length;
  const rollupMediumCount = rollup.filter((i) => i.severity === "MEDIUM").length;
  const rollupTone = zoneTone(rollup);

  // Best-effort correlation between the client-only "current session" and a
  // stored row — no shared id exists between them, so file name is the only
  // link available.
  const currentRowId = analyses.find((row) => row.file_name === currentSession?.fileName)?.id;

  const currentSeverity = severityCounts(currentSession?.analysis.thingsToWatch);

  const handleExport = () => {
    if (!currentSession) return;
    const blob = new Blob([JSON.stringify(currentSession.analysis, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = currentSession.fileName.replace(/\.pdf$/i, "") || "contract";
    a.href = url;
    a.download = `${baseName}-analysis.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handoff to the homepage, which restores this into the exact same
  // results-zone experience a fresh analysis gets — not a stripped-down
  // dashboard-only view.
  const viewContract = (fileName: string, analysis: ContractAnalysis) => {
    try {
      sessionStorage.setItem(VIEW_REQUEST_STORAGE_KEY, JSON.stringify({ fileName, analysis }));
    } catch {
      // Worst case the click just lands on the empty upload screen.
    }
    router.push("/");
  };

  return (
    <div className="ci-results" style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", display: "flex", flexDirection: "column" }}>
      <nav className="nav" style={{ borderBottom: "1px solid var(--color-divider)", flex: "none", position: "sticky", top: 0, zIndex: 50, background: "var(--color-bg)" }}>
        <Link href="/" className="nav-brand" style={{ color: "var(--color-text)" }}>
          Contract Intelligence
        </Link>
        <Link href="/" className="btn btn-primary blueprint">
          <Corners />
          New analysis
        </Link>
      </nav>

      <main style={{ flex: 1, minWidth: 0, padding: "32px 40px 90px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 900, display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Header */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 600 }}>Contracts</h1>
              <p className="text-muted" style={{ marginTop: 4, fontSize: 14 }}>
                {loading
                  ? "Loading…"
                  : `${totalCount} analyzed${
                      crossHighCount > 0
                        ? ` · ${crossHighCount} high-severity finding${crossHighCount === 1 ? "" : "s"} need review`
                        : ""
                    }`}
              </p>
            </div>
          </div>

          {error && (
            <p role="alert" className="card blueprint" style={{ padding: "12px 16px", borderColor: "var(--color-accent-700)", fontSize: 14, fontWeight: 500 }}>
              <Corners />
              {error}
            </p>
          )}

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="card blueprint" style={{ padding: "16px 18px" }}>
                    <Corners />
                    <div className="animate-pulse" style={{ height: 10, width: "60%", background: "color-mix(in srgb, var(--color-text) 12%, transparent)" }} />
                    <div className="animate-pulse" style={{ marginTop: 10, height: 22, width: "40%", background: "color-mix(in srgb, var(--color-text) 12%, transparent)" }} />
                  </div>
                ))}
              </div>
              <div className="text-muted" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <LightSpinner />
                Loading contracts…
              </div>
            </div>
          ) : totalCount === 0 && !currentSession ? (
            <div className="card blueprint" style={{ padding: 48, textAlign: "center" }}>
              <Corners />
              <p className="text-muted" style={{ fontSize: 14 }}>No contracts analyzed yet.</p>
              <Link href="/" className="btn btn-primary blueprint" style={{ marginTop: 16, display: "inline-flex" }}>
                <Corners />
                Analyze a contract
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              {/* Stat row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>
                <div className="card blueprint" style={{ padding: "16px 18px" }}>
                  <Corners />
                  <p className="card-kicker">Contracts analyzed</p>
                  <p style={{ marginTop: 6, fontSize: 26, fontWeight: 600 }}>{totalCount}</p>
                </div>
                <div className="card blueprint" style={{ padding: "16px 18px" }}>
                  <Corners />
                  <p className="card-kicker">High-severity findings</p>
                  <p style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 26, fontWeight: 600, color: crossHighCount > 0 ? "var(--color-accent-800)" : "var(--color-text)" }}>
                      {crossHighCount}
                    </span>
                    <span className="text-muted" style={{ fontSize: 12 }}>open</span>
                  </p>
                </div>
                <div className="card blueprint" style={{ padding: "16px 18px" }}>
                  <Corners />
                  <p className="card-kicker">Next deadline</p>
                  {nearestDeadline ? (
                    <p style={{ marginTop: 6, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 6 }}>
                      <span style={{ fontFamily: "var(--font-heading)", fontSize: 18, fontWeight: 600 }}>{nearestDeadline.dateValue}</span>
                      <span className="text-muted" style={{ fontSize: 12 }}>{nearestDeadline.label}</span>
                    </p>
                  ) : (
                    <p className="text-muted" style={{ marginTop: 6, fontSize: 18, fontWeight: 600 }}>None upcoming</p>
                  )}
                </div>
              </div>

              {/* Currently-open contract */}
              {currentSession && (
                <section className="card blueprint" style={{ padding: "20px 22px", borderColor: "var(--color-accent-700)" }}>
                  <Corners />
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <span className="tag tag-outline" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent-800)" }} />
                      Currently open
                    </span>
                    {(currentSession.analysis.commercialTerms?.contractValue?.value &&
                      currentSession.analysis.commercialTerms.contractValue.value !== "Not found") ||
                    currentSeverity.high > 0 ||
                    currentSeverity.medium > 0 ||
                    currentSeverity.low > 0 ? (
                      <div style={{ textAlign: "right" }}>
                        {currentSession.analysis.commercialTerms?.contractValue?.value &&
                          currentSession.analysis.commercialTerms.contractValue.value !== "Not found" && (
                            <p style={{ fontFamily: "var(--font-heading)", fontSize: 19, fontWeight: 600 }}>
                              {currentSession.analysis.commercialTerms.contractValue.value}
                            </p>
                          )}
                        {(currentSeverity.high > 0 || currentSeverity.medium > 0 || currentSeverity.low > 0) && (
                          <div style={{ marginTop: 6, display: "flex", justifyContent: "flex-end", gap: 6 }}>
                            {currentSeverity.high > 0 && (
                              <span className={SEVERITY_TAG_CLASS.HIGH}>{currentSeverity.high} high</span>
                            )}
                            {currentSeverity.medium > 0 && (
                              <span className={SEVERITY_TAG_CLASS.MEDIUM}>{currentSeverity.medium} medium</span>
                            )}
                            {currentSeverity.low > 0 && (
                              <span className={SEVERITY_TAG_CLASS.LOW}>{currentSeverity.low} low</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <h2 style={{ marginTop: 12, fontSize: 22, fontWeight: 600 }}>
                    {currentSession.analysis.contractOverview?.contractName?.value ?? currentSession.fileName}
                  </h2>
                  {currentSession.analysis.contractOverview?.parties?.value &&
                    currentSession.analysis.contractOverview.parties.value !== "Not found" && (
                      <p className="text-muted" style={{ marginTop: 4, fontSize: 14 }}>{currentSession.analysis.contractOverview.parties.value}</p>
                    )}
                  {currentSession.analysis.contractOverview?.purpose?.value &&
                    currentSession.analysis.contractOverview.purpose.value !== "Not found" && (
                      <p className="text-muted" style={{ marginTop: 8, maxWidth: 620, fontSize: 13.5, lineHeight: 1.55 }}>
                        {currentSession.analysis.contractOverview.purpose.value}
                      </p>
                    )}

                  <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                    <button type="button" className="btn btn-primary" onClick={() => viewContract(currentSession.fileName, currentSession.analysis)}>
                      View full analysis
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={handleExport}>
                      Export
                    </button>
                  </div>
                </section>
              )}

              {/* Recent contracts */}
              {analyses.length > 0 && (
                <section>
                  <p className="card-kicker" style={{ marginBottom: 10 }}>Recent contracts</p>
                  <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4 }}>
                    {analyses.map((row) => {
                      const preview = topWatchPreview(row.analysis.thingsToWatch);
                      const isCurrent = row.id === currentRowId;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => viewContract(row.file_name, row.analysis)}
                          className="card blueprint card-hover"
                          style={{ width: 250, flex: "none", padding: "14px 16px" }}
                        >
                          <Corners />
                          <p style={{ fontWeight: 600, fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {contractLabel(row.analysis, row.file_name)}
                          </p>
                          {row.analysis.contractOverview?.contractType?.value &&
                            row.analysis.contractOverview.contractType.value !== "Not found" && (
                              <p className="text-muted" style={{ marginTop: 2, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {row.analysis.contractOverview.contractType.value}
                              </p>
                            )}
                          <p className="text-muted" style={{ marginTop: 4, fontSize: 11 }}>
                            {isCurrent ? "Active session" : `Analyzed ${relativeTime(row.created_at)}`}
                          </p>
                          <div style={{ marginTop: 10 }}>
                            {preview ? (
                              <p style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                                <span className={SEVERITY_TAG_CLASS[preview.severity]} style={{ display: "inline-flex", alignItems: "center", gap: 5, flex: "none" }}>
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: SEVERITY_DOT[preview.severity] }} />
                                  {preview.severity}
                                </span>
                                <span className="text-muted" style={{ fontSize: 12, lineHeight: 1.4 }}>{preview.title}</span>
                              </p>
                            ) : (
                              <p className="text-muted" style={{ fontSize: 12, fontStyle: "italic" }}>No high-severity findings</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Cross-contract Things to Watch rollup */}
              {rollup.length > 0 && (
                <section className="card blueprint" style={{ padding: "20px 22px", borderColor: rollupTone.border }}>
                  <Corners />
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <p className="card-kicker" style={{ color: rollupTone.label, margin: 0 }}>
                      Things to watch — across your contracts
                    </p>
                    <p className="text-muted" style={{ fontSize: 12 }}>
                      {[
                        rollupHighCount > 0 ? `${rollupHighCount} high` : null,
                        rollupMediumCount > 0 ? `${rollupMediumCount} medium` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    {rollup.map((item, i) => {
                      const citation = formatCitation(item.section);
                      const provenance = [item.contractLabel, item.contractType].filter(Boolean).join(" · ");
                      return (
                        <div key={i} className="card blueprint" style={{ padding: "13px 15px", borderColor: SEVERITY_BORDER[item.severity] }}>
                          <Corners />
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span className={SEVERITY_TAG_CLASS[item.severity]} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: SEVERITY_DOT[item.severity] }} />
                                {item.severity}
                              </span>
                              <span style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</span>
                            </span>
                            <span style={{ display: "flex", flex: "none", alignItems: "center", gap: 6 }}>
                              {provenance && (
                                <span className="text-muted" style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, textAlign: "right" }}>
                                  {provenance}
                                </span>
                              )}
                              {citation && (
                                <span className="tag tag-neutral" style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {citation}
                                </span>
                              )}
                            </span>
                          </div>
                          <p className="text-muted" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>{item.explanation}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
