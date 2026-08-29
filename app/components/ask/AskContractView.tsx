"use client";

// The full-screen "Ask Your Contract" page — reached from the results
// toolbar's "Ask your contract" button, imported from the same Ask Your
// Contract.dc.html design and scoped under .ci-ask so it never leaks into
// the dark app shell. Same "Industry" light theme as app/components/landing,
// results and scan.
//
// This replaces the old Cmd+K command palette entirely: its deterministic
// "jump to a field" search is already covered by the results sidebar, and
// every real conversation now happens here instead of in a modal.

import { KeyboardEvent as ReactKeyboardEvent, useEffect, useRef, useState } from "react";
import type { ThingToWatch } from "@/lib/contract-analysis";
import { severityRank } from "@/lib/contract-analysis";
import type { ResultSectionId } from "../results/ResultsView";
import "./ask.css";

export interface AskHistoryEntry {
  question: string;
  answer: string;
  // Which section of the analysis the answer is about, per app/api/ask's
  // "section" classification — null when the model couldn't place it, in
  // which case the citation chip below the answer just doesn't render.
  section: ResultSectionId | null;
}

const SECTION_LABELS: Record<ResultSectionId, string> = {
  overview: "Contract Identity",
  dates: "Important Dates",
  terms: "Commercial Terms",
  clauses: "Key Clauses",
  watch: "Things to Watch",
  unknown: "Unknown Fields",
};

// Generic enough to make sense for any contract — not tied to specific
// extracted values, unlike the AI answers themselves.
const SUGGESTIONS_BY_SECTION: Record<ResultSectionId, string[]> = {
  overview: ["Who are the parties to this contract?", "What's the purpose of this agreement?", "What type of contract is this?"],
  dates: ["When does this contract renew?", "What's the notice period?", "Does this auto-renew?"],
  terms: ["What are the payment terms?", "Is there a price escalation clause?", "What's the total contract value?"],
  clauses: ["What's the liability cap?", "How can either party terminate this?", "What's the governing law?"],
  watch: ["What's the biggest risk in this contract?", "What should I negotiate before signing?"],
  unknown: ["What information is missing from this contract?", "Should I ask the other party to fill these gaps?"],
};

const SEVERITY_TAG_CLASS: Record<ThingToWatch["severity"], string> = {
  HIGH: "tag tag-outline",
  MEDIUM: "tag tag-accent",
  LOW: "tag tag-neutral",
};

// A one-time nudge at the top of the log — real HIGH/MEDIUM findings from
// this contract's own Things to Watch, not canned copy. Capped like the
// dashboard's cross-contract rollup so a contract with many flags doesn't
// turn this into a wall of buttons before any question has even been asked.
const RECOMMENDATION_CAP = 4;

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

function SectionCiteChip({ section, onClick }: { section: ResultSectionId; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tag tag-outline"
      style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", background: "none", font: "inherit" }}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
      {SECTION_LABELS[section]}
    </button>
  );
}

interface AskContractViewProps {
  fileName: string;
  section: ResultSectionId;
  thingsToWatch: ThingToWatch[];
  history: AskHistoryEntry[];
  pendingQuestion: string | null;
  error: string;
  onAsk: (question: string) => void;
  onBack: () => void;
  onJumpToSection: (section: ResultSectionId, watchIndex?: number) => void;
}

export default function AskContractView({
  fileName,
  section,
  thingsToWatch,
  history,
  pendingQuestion,
  error,
  onAsk,
  onBack,
  onJumpToSection,
}: AskContractViewProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  // New turns land at the bottom of a scrollable log, same as any chat view.
  useEffect(() => {
    logRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history.length, pendingQuestion]);

  const send = (question: string) => {
    const q = question.trim();
    if (!q || pendingQuestion) return;
    setDraft("");
    onAsk(q);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") send(draft);
  };

  const recommendations = [...thingsToWatch]
    .filter((w) => w.severity === "HIGH" || w.severity === "MEDIUM")
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .map((w, i) => ({ item: w, watchIndex: thingsToWatch.indexOf(w), key: `${w.title}-${i}` }))
    .slice(0, RECOMMENDATION_CAP);

  const suggestions = SUGGESTIONS_BY_SECTION[section] ?? SUGGESTIONS_BY_SECTION.overview;

  return (
    <div className="ci-ask" style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", display: "flex", flexDirection: "column" }}>
      <nav className="nav" style={{ borderBottom: "1px solid var(--color-divider)" }}>
        <span className="nav-brand">Contract Intelligence</span>
        <button type="button" className="btn btn-primary blueprint" style={{ marginLeft: "auto", whiteSpace: "nowrap" }} onClick={onBack}>
          <Corners />
          Back to Analysis
        </button>
      </nav>

      <main style={{ flex: 1, minWidth: 0, padding: "40px 40px 90px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <h1 style={{ fontSize: 28, margin: 0 }}>Ask Your Contract</h1>
            <span className="tag tag-accent" style={{ marginTop: 10, display: "inline-flex" }}>
              Viewing: {fileName} — {SECTION_LABELS[section]}
            </span>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              ref={inputRef}
              className="input"
              style={{ fontSize: 15, padding: "10px 14px" }}
              type="text"
              placeholder="Ask a question about this contract…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button type="button" className="btn btn-primary" style={{ flex: "none", padding: "0 20px" }} onClick={() => send(draft)}>
              Ask
            </button>
          </div>

          {error && (
            <p role="alert" style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: "var(--color-danger)" }}>
              {error}
            </p>
          )}

          <div>
            <p className="card-kicker" style={{ margin: "0 0 10px" }}>
              Suggested questions
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {suggestions.map((s) => (
                <button key={s} type="button" className="btn btn-secondary" style={{ fontSize: 12.5, padding: "6px 10px" }} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--color-divider)" }} />

          <div ref={logRef} style={{ display: "flex", flexDirection: "column" }}>
            {recommendations.length > 0 && (
              <div style={{ maxWidth: "92%" }}>
                <p className="text-muted" style={{ margin: "0 0 4px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  Contract AI
                </p>
                <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-accent-700)", padding: "12px 14px" }}>
                  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5 }}>Before you ask — a couple of things worth flagging in this contract:</p>
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    {recommendations.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        style={{
                          all: "unset",
                          boxSizing: "border-box",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          padding: "8px 10px",
                          border: "1px solid var(--color-divider)",
                          background: "var(--color-bg)",
                          textAlign: "left",
                        }}
                        onClick={() => onJumpToSection("watch", r.watchIndex)}
                      >
                        <span className={SEVERITY_TAG_CLASS[r.item.severity]} style={{ flex: "none", marginTop: 1 }}>
                          {r.item.severity}
                        </span>
                        <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>{r.item.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {history.map((entry, i) => {
              const prevSection = i > 0 ? history[i - 1].section : null;
              const isSameThread = i > 0 && !!entry.section && entry.section === prevSection;
              const wrapperStyle =
                isSameThread
                  ? { marginTop: 8, paddingLeft: 14, borderLeft: "2px solid var(--color-divider)" }
                  : { marginTop: i === 0 && recommendations.length === 0 ? 0 : 22 };

              return (
                <div key={i} style={{ ...wrapperStyle, animation: "ci-ask-fade-up 200ms ease both" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ maxWidth: "78%", background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "9px 13px", fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>
                      {entry.question}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 8 }}>
                    <div style={{ maxWidth: "85%" }}>
                      <p className="text-muted" style={{ margin: "0 0 4px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase" }}>
                        Contract AI
                      </p>
                      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-divider)", padding: "10px 13px" }}>
                        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>{entry.answer}</p>
                        {entry.section && <SectionCiteChip section={entry.section} onClick={() => onJumpToSection(entry.section as ResultSectionId)} />}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {pendingQuestion && (
              <div style={{ marginTop: history.length === 0 && recommendations.length === 0 ? 0 : 22 }}>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ maxWidth: "78%", background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "9px 13px", fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>
                    {pendingQuestion}
                  </div>
                </div>
                <p className="text-muted" style={{ margin: "8px 0 0", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="ci-ask-spinner" />
                  Thinking…
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
