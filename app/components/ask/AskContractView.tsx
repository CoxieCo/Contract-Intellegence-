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
import type { AskPassage } from "@/app/api/ask/route";
import CiteTag from "../results/CiteTag";
import "./ask.css";

export interface AskHistoryEntry {
  question: string;
  // Brief lead-in prose — can be empty when the answer is just the quote(s)
  // with nothing to introduce.
  intro: string;
  // One entry per clause quoted in the answer, each with its own real
  // page/section — see app/api/ask/route.ts's "passages" field. Empty when
  // the contract doesn't address the question at all (intro alone answers
  // it, nothing to cite).
  passages: AskPassage[];
  // Which category of the analysis the answer is about, per app/api/ask's
  // top-level "section" classification — used only to thread consecutive
  // same-topic answers together visually (see isSameThread below), not for
  // citations (each passage carries its own real page/section instead).
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

// Same chevron as the dashboard's "View all N items" rollup — kept as its
// own local copy rather than a shared import, matching how this codebase
// already treats every screen's small icons as independent (see e.g.
// CiteTag vs the old CiteChip: same behavior, deliberately separate copies).
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

// "pricing, liability cap, and termination rights" — Oxford comma, "and"
// before the last item. topics.length is always >= 2 at the one call site
// (see AnswerText), but this handles every length correctly regardless.
function joinTopics(topics: string[]): string {
  if (topics.length === 0) return "";
  if (topics.length === 1) return topics[0];
  if (topics.length === 2) return `${topics[0]} and ${topics[1]}`;
  return `${topics.slice(0, -1).join(", ")}, and ${topics[topics.length - 1]}`;
}

const expandToggleStyle: React.CSSProperties = {
  marginTop: 8,
  border: "none",
  background: "none",
  font: "inherit",
  color: "var(--color-accent-700)",
  fontSize: 13,
  fontWeight: 600,
  padding: 0,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

// One quoted clause: an optional short label ("On pricing:") if the model
// gave it a topic, the verbatim quote itself, and — the actual point of this
// change — a real citation opening PdfViewer at the exact page it came from,
// the same as any Field Card's or Things to Watch item's citation. Mirrors
// FieldCard's own hasCitation condition exactly, right down to only
// rendering CiteTag when there's a real page or section to show.
function AnswerPassage({ passage, onOpenCitation }: { passage: AskPassage; onOpenCitation: (page: number, section: string | null) => void }) {
  const hasCitation = passage.page != null || passage.section != null;
  return (
    <div style={{ marginTop: 8 }}>
      {passage.topic && (
        <p className="text-muted" style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600 }}>
          On {passage.topic}:
        </p>
      )}
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>{passage.quote}</p>
      {hasCitation && (
        <span style={{ display: "inline-flex", marginTop: 4 }}>
          <CiteTag page={passage.page} section={passage.section} onOpen={onOpenCitation} />
        </span>
      )}
    </div>
  );
}

function AnswerBody({ intro, passages, onOpenCitation }: { intro: string; passages: AskPassage[]; onOpenCitation: (page: number, section: string | null) => void }) {
  return (
    <>
      {intro && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>{intro}</p>}
      {passages.map((p, i) => (
        <AnswerPassage key={i} passage={p} onOpenCitation={onOpenCitation} />
      ))}
    </>
  );
}

// A simple factual question (one quoted clause, or none) renders in full —
// no expand step, nothing to scan past. An analytical question spanning
// several clauses (passages.length >= 2) instead opens on a short,
// scannable summary naming what those clauses are about, with the full
// exhaustive quoted breakdown — each passage with its own real citation —
// one click away. This never trims the answer itself — comprehensiveness is
// the deliberate choice for this feature (see app/api/ask/route.ts's system
// prompt); only the *default view* is short. The summary is built from each
// passage's "topic" rather than truncating the answer text, because a
// genuinely useful preview needs to say what's covered ("this touches
// pricing, liability, termination"), not just show the first clause and cut
// off mid-list.
function AnswerText({ intro, passages, onOpenCitation }: { intro: string; passages: AskPassage[]; onOpenCitation: (page: number, section: string | null) => void }) {
  const [expanded, setExpanded] = useState(false);

  if (passages.length < 2) {
    return <AnswerBody intro={intro} passages={passages} onOpenCitation={onOpenCitation} />;
  }

  if (!expanded) {
    const topics = passages.map((p) => p.topic).filter(Boolean);
    return (
      <>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>This touches {joinTopics(topics)}.</p>
        <button type="button" onClick={() => setExpanded(true)} style={expandToggleStyle}>
          Show full detail
          <ChevronIcon rotated={false} />
        </button>
      </>
    );
  }

  return (
    <>
      <AnswerBody intro={intro} passages={passages} onOpenCitation={onOpenCitation} />
      <button type="button" onClick={() => setExpanded(false)} style={expandToggleStyle}>
        Show less
        <ChevronIcon rotated={true} />
      </button>
    </>
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
  // Opens PdfViewer at a passage's real page/section — same prop shape as
  // ResultsView's own onOpenCitation, passed the same openCitation from
  // app/page.tsx, so an Ask citation behaves identically to every other
  // citation in the app.
  onOpenCitation: (page: number, section: string | null) => void;
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
  onOpenCitation,
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
                        <AnswerText intro={entry.intro} passages={entry.passages} onOpenCitation={onOpenCitation} />
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
