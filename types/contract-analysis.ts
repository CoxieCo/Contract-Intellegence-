// Mirrors the Master Extraction List in contract-analysis-spec.md.
// Every scalar field is a string because the AI is instructed to return
// the literal value "Not found" instead of omitting or inventing data
// (see spec: Missing Information Handling, Extraction Rule 2).

export interface ContractOverview {
  contractName: string;
  contractType: string;
  parties: string;
  status: string;
  purpose: string;
}

export interface ImportantDates {
  startDate: string;
  endDate: string;
  renewalDate: string;
  noticePeriod: string;
  noticeDeadline: string;
  autoRenewal: string;
}

export interface CommercialTerms {
  contractValue: string;
  currency: string;
  paymentTerms: string;
  paymentFrequency: string;
  pricing: string;
  priceEscalation: string;
  minimumCommitments: string;
  latePaymentTerms: string;
}

export interface KeyClauses {
  termination: string;
  earlyTermination: string;
  liability: string;
  liabilityCap: string;
  governingLaw: string;
  assignment: string;
  changeOfControl: string;
  ndaConfidentiality: string;
  dataComplianceObligations: string;
  slaCommitments: string;
}

export type ThingToWatchSeverity = "HIGH" | "MEDIUM" | "LOW";

export interface ThingToWatch {
  title: string;
  severity: ThingToWatchSeverity;
  explanation: string;
}

export interface ContractAnalysis {
  contractOverview: ContractOverview;
  importantDates: ImportantDates;
  commercialTerms: CommercialTerms;
  keyClauses: KeyClauses;
  thingsToWatch: ThingToWatch[];
}
