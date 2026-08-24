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
  severityCardStyle,
  severityStyles,
  severityDotClass,
  zoneTone,
} from "@/lib/contract-analysis";
import Spinner from "../components/Spinner";

interface StoredAnalysis {
  id: string;
  created_at: string;
  file_name: string;
  analysis: ContractAnalysis;
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
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-hairline bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[11px] font-semibold text-white">
              CI
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">Contract Intelligence</span>
          </Link>
          <span className="text-sm text-muted">/</span>
          <span className="text-sm font-medium text-foreground">Dashboard</span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* B1 — Header */}
        <div className="animate-fade-in mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Contracts</h1>
            <p className="mt-1 text-sm text-muted">
              {loading
                ? "Loading…"
                : `${totalCount} analyzed${
                    crossHighCount > 0
                      ? ` · ${crossHighCount} high-severity finding${crossHighCount === 1 ? "" : "s"} need review`
                      : ""
                  }`}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-strong hover:shadow-glow-accent active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            New analysis
          </Link>
        </div>

        {error && (
          <p role="alert" className="mb-6 rounded-md border border-severity-high-border bg-severity-high-bg px-4 py-3 text-sm font-medium text-severity-high">
            {error}
          </p>
        )}

        {loading ? (
          <div className="animate-fade-in space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-md border border-hairline bg-surface p-4 shadow-panel">
                  <div className="h-3 w-28 animate-pulse rounded bg-surface-raised" />
                  <div className="mt-2.5 h-6 w-16 animate-pulse rounded bg-surface-raised" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner />
              Loading contracts…
            </div>
          </div>
        ) : totalCount === 0 && !currentSession ? (
          <div className="animate-fade-in rounded-md border border-hairline bg-background/30 p-10 text-center">
            <p className="text-sm text-muted">No contracts analyzed yet.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-accent-strong active:scale-[0.97]"
            >
              Analyze a contract
            </Link>
          </div>
        ) : (
          <div className="animate-fade-in space-y-5">
            {/* B2 — Stat row */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-hairline bg-surface p-4 shadow-panel">
                <p className="text-xs text-muted">Contracts analyzed</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{totalCount}</p>
              </div>
              <div className="rounded-md border border-hairline bg-surface p-4 shadow-panel">
                <p className="text-xs text-muted">High-severity findings</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className={`text-2xl font-semibold tabular-nums ${crossHighCount > 0 ? "text-severity-high" : "text-foreground"}`}>
                    {crossHighCount}
                  </span>
                  <span className="text-xs text-muted">open</span>
                </p>
              </div>
              <div className="rounded-md border border-hairline bg-surface p-4 shadow-panel">
                <p className="text-xs text-muted">Next deadline</p>
                {nearestDeadline ? (
                  <p className="mt-1 flex flex-wrap items-baseline gap-1.5">
                    <span className="font-mono text-lg font-semibold text-foreground">{nearestDeadline.dateValue}</span>
                    <span className="text-xs text-muted">{nearestDeadline.label}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-lg font-semibold text-muted">None upcoming</p>
                )}
              </div>
            </div>

            {/* B3 — Currently-open contract */}
            {currentSession && (
              <section className="rounded-md border border-accent bg-accent/5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-surface-raised px-2.5 py-1 text-xs font-medium text-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    Currently open
                  </span>
                  {/* Contract value and severity badges are gated independently — a
                      contract with no extracted value (NDAs, DPAs, supplier terms)
                      still shows its severity summary instead of nothing at all. */}
                  {(currentSession.analysis.commercialTerms?.contractValue?.value &&
                    currentSession.analysis.commercialTerms.contractValue.value !== "Not found") ||
                  currentSeverity.high > 0 ||
                  currentSeverity.medium > 0 ||
                  currentSeverity.low > 0 ? (
                    <div className="text-right">
                      {currentSession.analysis.commercialTerms?.contractValue?.value &&
                        currentSession.analysis.commercialTerms.contractValue.value !== "Not found" && (
                          <p className="font-mono text-xl font-semibold tracking-[-0.01em] text-foreground">
                            {currentSession.analysis.commercialTerms.contractValue.value}
                          </p>
                        )}
                      {(currentSeverity.high > 0 || currentSeverity.medium > 0 || currentSeverity.low > 0) && (
                        <div className="mt-1.5 flex justify-end gap-1.5">
                          {currentSeverity.high > 0 && (
                            <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium tracking-[0.04em] ${severityStyles("HIGH")}`}>
                              {currentSeverity.high} high
                            </span>
                          )}
                          {currentSeverity.medium > 0 && (
                            <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium tracking-[0.04em] ${severityStyles("MEDIUM")}`}>
                              {currentSeverity.medium} medium
                            </span>
                          )}
                          {currentSeverity.low > 0 && (
                            <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium tracking-[0.04em] ${severityStyles("LOW")}`}>
                              {currentSeverity.low} low
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <h2 className="mt-3 text-xl font-semibold tracking-[-0.01em] text-foreground">
                  {currentSession.analysis.contractOverview?.contractName?.value ?? currentSession.fileName}
                </h2>
                {currentSession.analysis.contractOverview?.parties?.value &&
                  currentSession.analysis.contractOverview.parties.value !== "Not found" && (
                    <p className="mt-1 text-sm text-muted">{currentSession.analysis.contractOverview.parties.value}</p>
                  )}
                {currentSession.analysis.contractOverview?.purpose?.value &&
                  currentSession.analysis.contractOverview.purpose.value !== "Not found" && (
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                      {currentSession.analysis.contractOverview.purpose.value}
                    </p>
                  )}

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => viewContract(currentSession.fileName, currentSession.analysis)}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    View full analysis
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    className="rounded-md border border-hairline bg-surface px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    Export
                  </button>
                </div>
              </section>
            )}

            {/* B4 — Recent contracts */}
            {analyses.length > 0 && (
              <section>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-muted">Recent contracts</p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {analyses.map((row) => {
                    const preview = topWatchPreview(row.analysis.thingsToWatch);
                    const isCurrent = row.id === currentRowId;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => viewContract(row.file_name, row.analysis)}
                        className="w-64 shrink-0 rounded-md border border-hairline bg-surface p-4 text-left shadow-panel transition-all duration-200 hover:-translate-y-0.5 hover:border-hairline-strong hover:bg-surface-raised hover:shadow-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <p className="truncate text-sm font-semibold text-foreground">
                          {contractLabel(row.analysis, row.file_name)}
                        </p>
                        {row.analysis.contractOverview?.contractType?.value &&
                          row.analysis.contractOverview.contractType.value !== "Not found" && (
                            <p className="mt-0.5 truncate text-xs text-muted">
                              {row.analysis.contractOverview.contractType.value}
                            </p>
                          )}
                        <p className="mt-1 text-[11px] text-muted">
                          {isCurrent ? "Active session" : `Analyzed ${relativeTime(row.created_at)}`}
                        </p>
                        <div className="mt-2.5">
                          {preview ? (
                            <p className="flex items-start gap-1.5">
                              <span
                                className={`inline-flex shrink-0 items-center gap-1 rounded border px-1 py-0.5 text-[10px] font-medium tracking-[0.04em] ${severityStyles(preview.severity)}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${severityDotClass(preview.severity)}`} />
                                {preview.severity}
                              </span>
                              <span className="text-xs leading-4 text-muted">{preview.title}</span>
                            </p>
                          ) : (
                            <p className="text-xs italic text-muted">No high-severity findings</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* B5 — Cross-contract Things to Watch rollup */}
            {rollup.length > 0 && (
              <section className={`rounded-md border ${rollupTone.border} bg-background/30 p-5`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`text-[11px] font-medium uppercase tracking-[0.04em] ${rollupTone.label}`}>
                    Things to watch — across your contracts
                  </p>
                  <p className="text-xs tabular-nums text-muted">
                    {[
                      rollupHighCount > 0 ? `${rollupHighCount} high` : null,
                      rollupMediumCount > 0 ? `${rollupMediumCount} medium` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  {rollup.map((item, i) => {
                    const citation = formatCitation(item.section);
                    const provenance = [item.contractLabel, item.contractType].filter(Boolean).join(" · ");
                    return (
                      <div key={i} className={`rounded-md border p-3 ${severityCardStyle(item.severity)}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <span className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-medium tracking-[0.04em] ${severityStyles(item.severity)}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${severityDotClass(item.severity)}`} />
                              {item.severity}
                            </span>
                            <span className="text-sm font-medium text-foreground">{item.title}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            {provenance && (
                              <span className="max-w-[140px] truncate text-right text-xs text-muted">{provenance}</span>
                            )}
                            {citation && (
                              <span className="max-w-[140px] truncate rounded border border-hairline bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">
                                {citation}
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="mt-1.5 pl-0 text-sm leading-5 text-muted">{item.explanation}</p>
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
  );
}
