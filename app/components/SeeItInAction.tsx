"use client";

// Homepage marketing widget — an auto-playing, tabbed replay of four moments
// the product produces on a real contract (a caught auto-renewal, a flagged
// fee clause, an "ask a follow-up" answer, and a full-document scan). Content
// is fixed sample data ("Shown with a sample contract for illustration"),
// but every visual — citation chips, severity badge, accordion, spinner — is
// the same styling the real results view uses, not a simplified stand-in.

import { useEffect, useRef, useState } from "react";
import Spinner from "./Spinner";
import CiteChip from "./CiteChip";

type TabKind = "keyfacts" | "watch" | "ask" | "speed";

interface TabDef {
  id: string;
  label: string;
  kind: TabKind;
  file: string;
  page: string;
}

const TABS: TabDef[] = [
  { id: "renewal", label: "Auto-renewal caught", kind: "keyfacts", file: "MSA_Vendor_Services.pdf", page: "Page 2 of 38" },
  { id: "fee", label: "Hidden fee flagged", kind: "watch", file: "MSA_Vendor_Services.pdf", page: "Page 6 of 38" },
  { id: "ask", label: "Ask a follow-up question", kind: "ask", file: "MSA_Vendor_Services.pdf", page: "Page 11 of 38" },
  { id: "speed", label: "45-page contract in seconds", kind: "speed", file: "Master_Supply_Agreement.pdf", page: "45 pages" },
];

const KF_ROWS = [
  { label: "Renewal date", value: "14 Aug 2027", mono: true, cite: "§9.1" },
  { label: "Notice period", value: "90 days", mono: true, cite: "§9.1" },
  { label: "Auto-renewal", value: "Yes — renews automatically", mono: false, cite: "Page 2" },
] as const;

const WATCH_ITEM = {
  title: "Price escalation clause",
  explanation:
    "Fees increase 8% annually starting in year two — well above the 3–5% escalation typical for this contract type.",
  cite: "§4.3 · Page 6",
};

const ASK_QUESTION = "What happens if we terminate early?";
const ASK_ANSWER =
  "Early termination requires 60 days’ written notice and payment of the remaining minimum-commitment fees for the current term.";
const ASK_SOURCE_HINT = "Section 11.2, Early Termination";

const SPEED_ROWS = [
  { label: "Contract value", value: "$186,000/yr", mono: true, cite: "Page 3" },
  { label: "Governing law", value: "Delaware, USA", mono: false, cite: "Page 22" },
  { label: "Liability cap", value: "$250,000", mono: true, cite: "Page 31" },
] as const;

const SCAN_TOTAL_PAGES = 45;

// ---------- Icons (same stroke language as the rest of the app) ----------

function FileIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// ---------- Animation state ----------

interface DemoState {
  kfPhase: [number, number, number];
  watchCardIn: boolean;
  watchOpen: boolean;
  watchCite: boolean;
  askTyped: number;
  askLoading: boolean;
  askAnswerIn: boolean;
  askCite: boolean;
  scanPage: number;
  scanDone: boolean;
  speedFacts: [boolean, boolean, boolean];
}

function freshState(): DemoState {
  return {
    kfPhase: [0, 0, 0],
    watchCardIn: false,
    watchOpen: false,
    watchCite: false,
    askTyped: 0,
    askLoading: false,
    askAnswerIn: false,
    askCite: false,
    scanPage: 0,
    scanDone: false,
    speedFacts: [false, false, false],
  };
}

// ---------- Tab content panels ----------

function KeyFactsPanel({ state }: { state: DemoState }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.04em] text-muted">Key facts</p>
      <div>
        {KF_ROWS.map((row, i) => {
          const phase = state.kfPhase[i];
          if (phase < 1) return null;
          const highlighted = i === 2 && phase >= 2;
          const isLast = i === KF_ROWS.length - 1;
          return (
            <div
              key={row.label}
              className={`animate-fade-in flex items-center justify-between gap-4 rounded-md py-2.5 transition-colors duration-300 ${
                isLast ? "border-transparent" : "border-b border-hairline"
              } ${highlighted ? "-mx-2.5 border-transparent bg-accent/10 px-2.5 ring-1 ring-accent" : ""}`}
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">{row.label}</span>
              <span className="flex items-center gap-2">
                <span className={`tabular-nums text-sm text-foreground ${row.mono ? "font-mono" : ""} ${i === 2 ? "font-semibold" : ""}`}>
                  {row.value}
                </span>
                {phase >= 2 && <CiteChip actionable={false} label={row.cite} className="animate-pop-in" />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WatchPanel({ state, onToggle }: { state: DemoState; onToggle: () => void }) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.04em] text-severity-high">Things to watch</p>
      {state.watchCardIn && (
        <div className="animate-fade-in rounded-md border border-severity-high-border bg-severity-high-bg px-3.5">
          <div className="flex items-center justify-between gap-3 py-3">
            <button
              type="button"
              onClick={onToggle}
              className="flex flex-1 items-center gap-2.5 text-left text-muted transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ChevronIcon open={state.watchOpen} />
              <span className="inline-flex items-center gap-1.5 rounded border border-severity-high-border px-1.5 py-0.5 text-[11px] font-medium tracking-[0.04em] text-severity-high">
                <span className="h-1.5 w-1.5 rounded-full bg-severity-high" />
                HIGH
              </span>
              <span className="text-sm font-medium text-foreground">{WATCH_ITEM.title}</span>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <span className="whitespace-nowrap rounded border border-hairline bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">
                Why is this risky?
              </span>
              {state.watchCite && <CiteChip actionable={false} label={WATCH_ITEM.cite} className="animate-pop-in" />}
            </div>
          </div>
          <div className={`accordion-panel ${state.watchOpen ? "is-open" : ""}`}>
            <div>
              <p className="pb-3.5 pl-6 text-[13px] leading-5 text-muted">{WATCH_ITEM.explanation}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AskPanel({ state }: { state: DemoState }) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.04em] text-muted">Ask a follow-up question</p>
      <div className="flex items-center gap-2.5 rounded-md border border-hairline bg-background/40 px-3.5 py-3">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
        <span className="whitespace-pre text-sm text-foreground">{ASK_QUESTION.slice(0, state.askTyped)}</span>
        {state.askTyped < ASK_QUESTION.length && (
          <span className="animate-caret-blink inline-block h-4 w-0.5 bg-foreground" />
        )}
      </div>
      {state.askLoading && (
        <div className="flex items-center gap-2 px-0.5 py-3.5 text-[13px] text-muted">
          <Spinner />
          Thinking…
        </div>
      )}
      {state.askAnswerIn && (
        <div className="animate-fade-in mt-3 rounded-md border border-hairline bg-background/40 p-3.5">
          <p className="text-[13px] font-medium text-muted">{ASK_QUESTION}</p>
          <p className="mt-1.5 text-sm leading-5 text-foreground">{ASK_ANSWER}</p>
          {state.askCite && (
            <div className="mt-2">
              <CiteChip actionable={false} label={ASK_SOURCE_HINT} className="animate-pop-in" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpeedPanel({ tab, state }: { tab: TabDef; state: DemoState }) {
  const pct = Math.round((state.scanPage / SCAN_TOTAL_PAGES) * 100);
  return (
    <div>
      <p className="mb-3.5 text-[11px] font-medium uppercase tracking-[0.04em] text-muted">Scanning</p>
      <div className="mb-3.5 flex items-center gap-2.5">
        <FileIcon className="text-muted" />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-foreground">{tab.file}</p>
          <p className="mt-0.5 font-mono text-xs text-muted">
            {state.scanDone ? "Scan complete" : `Scanning page ${state.scanPage} of ${SCAN_TOTAL_PAGES}…`}
          </p>
        </div>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-75 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      {state.scanDone && (
        <div className="animate-pop-in mb-3.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-surface-raised px-2.5 py-1 text-[11px] font-medium text-foreground">
            <CheckIcon className="text-accent" />
            Analyzed in 2.8s
          </span>
        </div>
      )}
      <div>
        {SPEED_ROWS.map((row, i) => {
          if (!state.speedFacts[i]) return null;
          const isLast = i === SPEED_ROWS.length - 1;
          return (
            <div
              key={row.label}
              className={`animate-fade-in flex items-center justify-between gap-4 py-2.5 ${
                isLast ? "" : "border-b border-hairline"
              }`}
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">{row.label}</span>
              <span className="flex items-center gap-2">
                <span className={`tabular-nums text-sm text-foreground ${row.mono ? "font-mono" : ""}`}>{row.value}</span>
                <CiteChip actionable={false} label={row.cite} className="animate-pop-in" />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Animated content panel ----------
//
// Keyed by tabIndex from the parent (`key={activeTab}`) so switching tabs
// remounts this component instead of the effect resetting state in place —
// a fresh `useState(freshState)` on mount, no synchronous setState in an
// effect body.
function DemoPanel({ tabIndex }: { tabIndex: number }) {
  const [state, setState] = useState<DemoState>(freshState);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clearTimers = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    const schedule = (delay: number, patch: Partial<DemoState>) => {
      timers.current.push(setTimeout(() => setState((s) => ({ ...s, ...patch })), delay));
    };

    const play = () => {
      clearTimers();
      const kind = TABS[tabIndex].kind;
      let loopAt = 5000;

      if (kind === "keyfacts") {
        schedule(300, { kfPhase: [1, 0, 0] });
        schedule(600, { kfPhase: [2, 0, 0] });
        schedule(950, { kfPhase: [2, 1, 0] });
        schedule(1250, { kfPhase: [2, 2, 0] });
        schedule(1600, { kfPhase: [2, 2, 1] });
        schedule(1950, { kfPhase: [2, 2, 2] });
        loopAt = 4600;
      } else if (kind === "watch") {
        schedule(300, { watchCardIn: true });
        schedule(950, { watchOpen: true });
        schedule(1400, { watchCite: true });
        loopAt = 4800;
      } else if (kind === "ask") {
        for (let i = 1; i <= ASK_QUESTION.length; i++) schedule(250 + i * 30, { askTyped: i });
        const typedEnd = 250 + ASK_QUESTION.length * 30;
        schedule(typedEnd + 300, { askLoading: true });
        schedule(typedEnd + 300 + 900, { askLoading: false, askAnswerIn: true });
        schedule(typedEnd + 300 + 900 + 300, { askCite: true });
        loopAt = typedEnd + 300 + 900 + 300 + 2400;
      } else if (kind === "speed") {
        for (let p = 1; p <= SCAN_TOTAL_PAGES; p++) schedule(150 + p * 14, { scanPage: p });
        const scanEnd = 150 + SCAN_TOTAL_PAGES * 14;
        schedule(scanEnd + 250, { scanDone: true });
        schedule(scanEnd + 450, { speedFacts: [true, false, false] });
        schedule(scanEnd + 530, { speedFacts: [true, true, false] });
        schedule(scanEnd + 610, { speedFacts: [true, true, true] });
        loopAt = scanEnd + 610 + 2400;
      }

      timers.current.push(
        setTimeout(() => {
          setState(freshState());
          play();
        }, loopAt)
      );
    };

    play();

    return clearTimers;
  }, [tabIndex]);

  const tab = TABS[tabIndex];

  return (
    <div className="min-h-[320px] px-5 py-6">
      {tab.kind === "keyfacts" && <KeyFactsPanel state={state} />}
      {tab.kind === "watch" && (
        <WatchPanel state={state} onToggle={() => setState((s) => ({ ...s, watchOpen: !s.watchOpen }))} />
      )}
      {tab.kind === "ask" && <AskPanel state={state} />}
      {tab.kind === "speed" && <SpeedPanel tab={tab} state={state} />}
    </div>
  );
}

// ---------- Main widget ----------

export default function SeeItInAction() {
  const [activeTab, setActiveTab] = useState(0);
  const tab = TABS[activeTab];

  return (
    <section className="border-y border-hairline bg-surface/40">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:py-[72px]">
        <div className="mx-auto mb-10 max-w-xl text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">See it in action</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-[32px]">
            Real output, not a mockup
          </h2>
          <p className="mt-3 text-[15px] leading-6 text-muted">
            Pick a moment below. Each tab replays the exact screens the product shows when it finds that in your
            contract.
          </p>
        </div>

        <div className="mb-7 flex flex-wrap justify-center gap-2">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`whitespace-nowrap rounded-md px-4 py-2.5 text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                i === activeTab
                  ? "bg-accent text-white hover:bg-accent-strong"
                  : "border border-hairline bg-surface text-muted hover:border-hairline-strong hover:bg-surface-raised hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-md border border-hairline bg-surface shadow-panel">
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <FileIcon className="text-muted" />
              <span className="truncate text-[13px] font-medium text-foreground">{tab.file}</span>
              <span className="whitespace-nowrap font-mono text-[11px] text-muted">{tab.page}</span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-hairline-strong bg-surface-raised px-3 py-1.5 text-[11px] font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Live demo
            </span>
          </div>

          <DemoPanel key={activeTab} tabIndex={activeTab} />
        </div>

        <p className="mt-4 text-center text-xs text-muted">Shown with a sample contract for illustration.</p>
      </div>
    </section>
  );
}
