"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CSSProperties, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ContractAnalysis,
  CURRENT_ANALYSIS_STORAGE_KEY,
  CurrentAnalysisSession,
  ThingToWatch,
  VIEW_REQUEST_STORAGE_KEY,
  severityRank,
} from "@/lib/contract-analysis";
import "../components/results/results.css";
import CiteTag from "../components/results/CiteTag";

interface StoredAnalysis {
  id: string;
  created_at: string;
  file_name: string;
  analysis: ContractAnalysis;
}

// ---------- Severity treatment — danger/warning tokens, per the Dashboard.dc.html design ----------

function tagStyleFor(sev: ThingToWatch["severity"]): CSSProperties {
  if (sev === "HIGH") return { border: "1px solid var(--color-danger)", color: "var(--color-danger)", background: "transparent" };
  if (sev === "MEDIUM") return { border: "1px solid transparent", color: "var(--color-warning-text)", background: "var(--color-warning-bg)" };
  return { border: "1px solid transparent", color: "var(--color-neutral-800)", background: "var(--color-neutral-100)" };
}

function dotColorFor(sev: ThingToWatch["severity"]): string {
  if (sev === "HIGH") return "var(--color-danger-dot)";
  if (sev === "MEDIUM") return "var(--color-warning-dot)";
  return "var(--color-neutral-500)";
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

function ChevronIcon({ rotated }: { rotated: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none", opacity: 0.6, transform: rotated ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 220ms cubic-bezier(0.4,0,0.2,1)" }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
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
  rowId: string;
  key: string;
}

// Every HIGH/MEDIUM item across every stored analysis, sorted HIGH first.
function buildRollup(rows: StoredAnalysis[]): RollupItem[] {
  const items: RollupItem[] = [];
  for (const row of rows) {
    const label = contractLabel(row.analysis, row.file_name);
    const type = row.analysis.contractOverview?.contractType?.value ?? "";
    (row.analysis.thingsToWatch ?? []).forEach((item, idx) => {
      if (item.severity === "HIGH" || item.severity === "MEDIUM") {
        items.push({ ...item, contractLabel: label, contractType: type !== "Not found" ? type : "", rowId: row.id, key: `${row.id}:${idx}` });
      }
    });
  }
  return items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

const ROLLUP_CAP = 4;

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

  // The dashboard only ever holds extracted data, never a source PDF (unlike
  // the results view, which can open the real file for a live upload) — any
  // citation clicked here always lands on this same "not available" notice.
  const [viewerCitation, setViewerCitation] = useState<{ page: number; section: string | null } | null>(null);
  const openCitation = (page: number, section: string | null) => setViewerCitation({ page, section });

  // Clicking a "Recent contracts" tile filters the Things to Watch rollup
  // down to that one contract (and swaps the detail panel to it) rather than
  // navigating away — click the same tile again to clear the filter.
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [expandedRollupRows, setExpandedRollupRows] = useState<Record<string, boolean>>({});
  const [showAllRollup, setShowAllRollup] = useState(false);

  const toggleContractFilter = (rowId: string) => {
    // Clicking the tile that's already effectively shown (whether that's an
    // explicit selection or just the default open contract) reverts to the
    // default rather than leaving the filter pinned to the same contract.
    setSelectedContractId((prev) => ((prev ?? defaultOpenRowId) === rowId ? null : rowId));
    setShowAllRollup(false);
    setExpandedRollupRows({});
  };
  const toggleRollupRow = (key: string) => setExpandedRollupRows((s) => ({ ...s, [key]: !s[key] }));

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

  // Best-effort correlation between the client-only "current session" and a
  // stored row — no shared id exists between them, so file name is the only
  // link available.
  const currentRowId = analyses.find((row) => row.file_name === currentSession?.fileName)?.id;

  // With no explicit tile selection, the dashboard opens focused on the live
  // session's contract if there is one, else the most recently analyzed one
  // (the API already returns `analyses` newest-first) — never an empty panel
  // when there's something to show. Clicking a Recent Contracts tile
  // overrides this; clicking that same tile again reverts to the default.
  const defaultOpenRowId = currentRowId ?? analyses[0]?.id ?? null;
  const effectiveSelectedId = selectedContractId ?? defaultOpenRowId;

  const selectedRow = effectiveSelectedId ? analyses.find((r) => r.id === effectiveSelectedId) ?? null : null;
  const filteredRollup = effectiveSelectedId ? rollup.filter((i) => i.rowId === effectiveSelectedId) : rollup;
  const rollupHighCount = filteredRollup.filter((i) => i.severity === "HIGH").length;
  const rollupMediumCount = filteredRollup.filter((i) => i.severity === "MEDIUM").length;
  const canExpandRollup = filteredRollup.length > ROLLUP_CAP;
  const visibleRollup = showAllRollup ? filteredRollup : filteredRollup.slice(0, ROLLUP_CAP);
  const rollupIsEmpty = filteredRollup.length === 0;
  const rollupBorder = rollupHighCount > 0 ? "var(--color-danger)" : rollupMediumCount > 0 ? "var(--color-warning-border)" : "var(--color-divider)";
  const rollupLabelColor = rollupHighCount > 0 ? "var(--color-danger)" : rollupMediumCount > 0 ? "var(--color-warning-text)" : "var(--color-text)";
  const rollupCountLabel = [rollupHighCount > 0 ? `${rollupHighCount} high` : null, rollupMediumCount > 0 ? `${rollupMediumCount} medium` : null]
    .filter(Boolean)
    .join(" · ");

  // The detail panel shows whichever contract is selected via a Recent
  // Contracts tile (defaulting as above), falling back to the live session's
  // contract directly if it hasn't shown up in `analyses` yet — the same
  // "open" target both "View full analysis" and "Export" act on.
  const openTarget: { fileName: string; analysis: ContractAnalysis } | null = selectedRow
    ? { fileName: selectedRow.file_name, analysis: selectedRow.analysis }
    : currentSession
    ? { fileName: currentSession.fileName, analysis: currentSession.analysis }
    : analyses[0]
    ? { fileName: analyses[0].file_name, analysis: analyses[0].analysis }
    : null;
  const openLabel = openTarget ? contractLabel(openTarget.analysis, openTarget.fileName) : "";
  const openValue = openTarget?.analysis.commercialTerms?.contractValue?.value;
  const openHasValue = !!openValue && openValue !== "Not found";
  const openParties = openTarget?.analysis.contractOverview?.parties?.value;
  const openPurpose = openTarget?.analysis.contractOverview?.purpose?.value;

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
        <Link href="/" className="nav-brand" style={{ color: "var(--color-text)", marginRight: 0 }}>
          Contract Intelligence
        </Link>
        <span className="text-muted" style={{ fontSize: 14 }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Dashboard</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
          {currentSession && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => viewContract(currentSession.fileName, currentSession.analysis)}
            >
              Back to Analysis
            </button>
          )}
          <Link href="/" className="btn btn-primary blueprint">
            <Corners />
            New analysis
          </Link>
        </div>
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
            <p role="alert" className="card blueprint" style={{ padding: "12px 16px", borderColor: "var(--color-danger)", fontSize: 14, fontWeight: 500 }}>
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
                    <span style={{ fontSize: 26, fontWeight: 600, color: crossHighCount > 0 ? "var(--color-danger)" : "var(--color-text)" }}>
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

              {/* Open contract detail — the live session by default, or whichever
                  Recent Contracts tile is selected as a filter */}
              {openTarget && (
                <section className="card blueprint" style={{ padding: "20px 22px", borderColor: "var(--color-accent-700)" }}>
                  <Corners />
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <span className="tag tag-outline" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent-800)" }} />
                      Currently open
                    </span>
                    {openHasValue && (
                      <p style={{ fontFamily: "var(--font-heading)", fontSize: 19, fontWeight: 600, margin: 0 }}>{openValue}</p>
                    )}
                  </div>

                  <h2 style={{ marginTop: 12, fontSize: 22, fontWeight: 600 }}>{openLabel}</h2>
                  {openParties && openParties !== "Not found" && (
                    <p className="text-muted" style={{ marginTop: 4, fontSize: 14 }}>{openParties}</p>
                  )}
                  {openPurpose && openPurpose !== "Not found" && (
                    <p className="text-muted" style={{ marginTop: 8, maxWidth: 620, fontSize: 13.5, lineHeight: 1.55 }}>{openPurpose}</p>
                  )}

                  <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                    <button type="button" className="btn btn-primary" onClick={() => viewContract(openTarget.fileName, openTarget.analysis)}>
                      View full analysis
                    </button>
                  </div>
                </section>
              )}

              {/* Recent contracts — click a tile to filter the rollup below to
                  just that contract; click again to clear the filter */}
              {analyses.length > 0 && (
                <section>
                  <p className="card-kicker" style={{ marginBottom: 10 }}>Recent contracts</p>
                  <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4 }}>
                    {analyses.map((row) => {
                      const preview = topWatchPreview(row.analysis.thingsToWatch);
                      const isCurrent = row.id === currentRowId;
                      const isSelected = row.id === effectiveSelectedId;
                      return (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => toggleContractFilter(row.id)}
                          className="card blueprint card-hover"
                          style={{
                            width: 250,
                            flex: "none",
                            padding: "14px 16px",
                            borderColor: isSelected ? "var(--color-accent-700)" : "var(--color-divider)",
                            background: isSelected ? "var(--color-accent-100)" : "transparent",
                          }}
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
                                <span className="tag" style={{ ...tagStyleFor(preview.severity), display: "inline-flex", alignItems: "center", gap: 5, flex: "none" }}>
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: dotColorFor(preview.severity) }} />
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

              {/* Cross-contract Things to Watch rollup — expandable rows,
                  optionally filtered to one contract via the tiles above */}
              <section className="card blueprint" style={{ padding: "20px 22px", borderColor: rollupBorder }}>
                <Corners />
                <p className="card-kicker" style={{ color: rollupLabelColor, margin: 0 }}>Things to watch</p>
                {rollupCountLabel && (
                  <p className="text-muted" style={{ fontSize: 12, margin: "4px 0 0" }}>{rollupCountLabel}</p>
                )}

                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  {visibleRollup.map((item) => {
                    const isOpen = !!expandedRollupRows[item.key];
                    const hasCitation = item.page != null || item.section != null;
                    const provenance = [item.contractLabel, item.contractType].filter(Boolean).join(" · ");
                    return (
                      <div
                        key={item.key}
                        className="blueprint"
                        style={{ position: "relative", border: `1px solid ${item.severity === "HIGH" ? "var(--color-danger)" : "var(--color-divider)"}` }}
                      >
                        <Corners />
                        <button
                          type="button"
                          onClick={() => toggleRollupRow(item.key)}
                          style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 15px" }}
                        >
                          <span className="tag" style={{ ...tagStyleFor(item.severity), display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColorFor(item.severity) }} />
                            {item.severity}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: 14, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.title}
                          </span>
                          <span className="text-muted" style={{ fontSize: 12, flex: "none", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.contractLabel}
                          </span>
                          <ChevronIcon rotated={isOpen} />
                        </button>

                        <div className={`ci-accordion-panel ${isOpen ? "is-open" : ""}`}>
                          <div>
                            <div style={{ padding: "10px 15px 14px", borderTop: "1px solid var(--color-divider)", margin: "0 15px" }}>
                              <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.55, margin: 0 }}>{item.explanation}</p>
                              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                <span className="text-muted" style={{ fontSize: 12 }}>{provenance}</span>
                                {hasCitation && <CiteTag page={item.page} section={item.section} onOpen={openCitation} maxWidth={170} />}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {rollupIsEmpty && (
                  <p className="text-muted" style={{ fontSize: 13, padding: "10px 2px 0", margin: 0 }}>
                    No high or medium severity items for this contract.
                  </p>
                )}

                {canExpandRollup && (
                  <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
                    <button
                      type="button"
                      onClick={() => setShowAllRollup((s) => !s)}
                      className="btn"
                      style={{ border: "none", color: "var(--color-accent)", fontSize: 13, padding: "6.8px 12px" }}
                    >
                      {showAllRollup ? "Show less" : `View all ${filteredRollup.length} items`}
                      <ChevronIcon rotated={showAllRollup} />
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      {viewerCitation && (
        <div
          role="presentation"
          onClick={() => setViewerCitation(null)}
          className="animate-fade-in"
          style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: "32px 16px" }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Source unavailable"
            onClick={(e) => e.stopPropagation()}
            className="card blueprint"
            style={{ width: "100%", maxWidth: 380, padding: 20, textAlign: "center", background: "var(--color-bg)" }}
          >
            <Corners />
            <p style={{ fontWeight: 600, fontSize: 15 }}>Original PDF not available</p>
            <p className="text-muted" style={{ marginTop: 6, fontSize: 13.5, lineHeight: 1.55 }}>
              This citation points to page {viewerCitation.page}
              {viewerCitation.section ? `, ${viewerCitation.section}` : ""} — but only the extracted data is saved
              across your contracts, not the source files.
            </p>
            <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setViewerCitation(null)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
