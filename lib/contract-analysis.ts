// Shared between app/page.tsx and app/dashboard/page.tsx. Mirrors the JSON
// shape app/api/analyze/route.ts asks Claude for (see that file's prompt).

export interface SourcedValue {
  value: string;
  page: number | null;
  section: string | null;
}

export interface ContractOverview {
  contractName: SourcedValue;
  contractType: SourcedValue;
  parties: SourcedValue;
  status: SourcedValue;
  purpose: SourcedValue;
}

export interface ImportantDates {
  startDate: SourcedValue;
  endDate: SourcedValue;
  renewalDate: SourcedValue;
  noticePeriod: SourcedValue;
  noticeDeadline: SourcedValue;
  autoRenewal: SourcedValue;
}

export interface CommercialTerms {
  contractValue: SourcedValue;
  currency: SourcedValue;
  paymentTerms: SourcedValue;
  paymentFrequency: SourcedValue;
  pricing: SourcedValue;
  priceEscalation: SourcedValue;
  minimumCommitments: SourcedValue;
  latePaymentTerms: SourcedValue;
}

export interface KeyClauses {
  termination: SourcedValue;
  earlyTermination: SourcedValue;
  liability: SourcedValue;
  liabilityCap: SourcedValue;
  governingLaw: SourcedValue;
  assignment: SourcedValue;
  changeOfControl: SourcedValue;
  ndaConfidentiality: SourcedValue;
  dataComplianceObligations: SourcedValue;
  slaCommitments: SourcedValue;
}

export interface ThingToWatch {
  title: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  explanation: string;
  page: number | null;
  section: string | null;
}

export interface ContractAnalysis {
  contractOverview?: ContractOverview;
  importantDates?: ImportantDates;
  commercialTerms?: CommercialTerms;
  keyClauses?: KeyClauses;
  thingsToWatch?: ThingToWatch[];
}

// Same badge treatment used throughout app/page.tsx's Things to Watch UI —
// reused here rather than reinvented so severity always reads consistently.
export function severityStyles(severity: ThingToWatch["severity"]) {
  switch (severity) {
    case "HIGH":
      return "bg-severity-high-bg text-severity-high border-severity-high-border";
    case "MEDIUM":
      return "bg-severity-medium-bg text-severity-medium border-severity-medium-border";
    case "LOW":
    default:
      return "bg-severity-low-bg text-severity-low border-severity-low-border";
  }
}

export function severityCardStyle(severity: ThingToWatch["severity"]) {
  switch (severity) {
    case "HIGH":
      return "border-severity-high-border bg-severity-high-bg";
    case "MEDIUM":
      return "border-severity-medium-border/60 bg-severity-medium-bg/60";
    case "LOW":
    default:
      return "border-hairline bg-transparent";
  }
}

export const severityRank: Record<ThingToWatch["severity"], number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

// Small colored dot rendered before a severity badge's label — same
// dot-plus-label pattern as the status pill and the hero's "AI-powered" badge.
export function severityDotClass(severity: ThingToWatch["severity"]) {
  switch (severity) {
    case "HIGH":
      return "bg-severity-high";
    case "MEDIUM":
      return "bg-severity-medium";
    case "LOW":
    default:
      return "bg-severity-low";
  }
}

// Tone for a "Things to Watch" container, derived from the actual severity
// mix inside it rather than hardcoded to HIGH — a container holding only
// LOW findings (or none) shouldn't wear the same red frame as one with a
// real HIGH-severity flag.
export function zoneTone(items: { severity: ThingToWatch["severity"] }[]) {
  const hasHigh = items.some((i) => i.severity === "HIGH");
  const hasMedium = items.some((i) => i.severity === "MEDIUM");
  if (hasHigh) return { border: "border-severity-high-border", label: "text-severity-high" };
  if (hasMedium) return { border: "border-severity-medium-border", label: "text-severity-medium" };
  return { border: "border-hairline", label: "text-muted" };
}

// The homepage writes the just-completed analysis here so the dashboard can
// show a "Currently open" card for it — sessionStorage rather than a shared
// store/context, since it only needs to survive within the same tab/session.
export const CURRENT_ANALYSIS_STORAGE_KEY = "contract-intelligence:currentAnalysis";

export interface CurrentAnalysisSession {
  fileName: string;
  analysis: ContractAnalysis;
}

// The dashboard writes here right before navigating to "/" so the homepage
// can restore a past (or the current) analysis into the exact same results
// view — same shape as CurrentAnalysisSession, kept as a separate key so
// "what's currently open in this tab" and "what was just requested to view"
// don't collide.
export const VIEW_REQUEST_STORAGE_KEY = "contract-intelligence:viewRequest";
