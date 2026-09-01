// The 3 canned contracts behind the sample-scan section's cards. Each one's
// `analysis` is a fully scripted (not real) ContractAnalysis — same shape
// ResultsView renders for a genuine scan — used only to drive
// SampleScanSection's illustrative scan/results playback. No PDF is ever
// read or stored for these; fields the "document" doesn't state are marked
// "Not found", same as a real analysis would.

import type { ContractAnalysis } from "@/lib/contract-analysis";

const MISSING = { value: "Not found", page: null, section: null } as const;

export interface DemoContract {
  id: string;
  filename: string;
  pages: number;
  /** Short label on the draggable icon card, e.g. "Retail Lease". */
  shortLabel: string;
  /** Category badge on the descriptive card, e.g. "COMMERCIAL LEASE". */
  badge: string;
  /** Full title on the descriptive card. */
  title: string;
  /** One-line description of this contract's specific hook. */
  description: string;
  analysis: ContractAnalysis;
}

export const SAMPLE_CONTRACTS: DemoContract[] = [
  {
    id: "lease",
    filename: "Retail_Lease_Agreement.pdf",
    pages: 62,
    shortLabel: "Retail Lease",
    badge: "COMMERCIAL LEASE",
    title: "Retail Lease Agreement",
    description: "A renewal window that opens automatically — miss the notice period and you're locked in for two more years.",
    analysis: {
      contractOverview: {
        contractName: { value: "Retail Lease Agreement", page: 1, section: "Cover Page" },
        contractType: { value: "Commercial Lease", page: 1, section: "Cover Page" },
        parties: { value: "Acme Corp × Landlord Pty Ltd", page: 1, section: "Agreement Overview" },
        status: MISSING,
        purpose: MISSING,
      },
      importantDates: {
        startDate: MISSING,
        endDate: MISSING,
        renewalDate: { value: "Two (2) years commencing on expiry of the Initial Term", page: null, section: "Item 13, Special Condition 1,4" },
        noticePeriod: { value: "Not less than three (3) months prior to expiry", page: null, section: "Special Condition 4.2" },
        noticeDeadline: MISSING,
        autoRenewal: { value: "Yes — renews automatically unless notice is given", page: null, section: "Item 13, Special Condition 1,4" },
      },
      commercialTerms: {
        contractValue: MISSING,
        currency: MISSING,
        paymentTerms: MISSING,
        paymentFrequency: MISSING,
        pricing: MISSING,
        priceEscalation: { value: "CPI-linked, reviewed annually", page: null, section: "Item 9" },
        minimumCommitments: MISSING,
        latePaymentTerms: MISSING,
      },
      keyClauses: {
        termination: MISSING,
        earlyTermination: MISSING,
        liability: MISSING,
        liabilityCap: MISSING,
        governingLaw: MISSING,
        assignment: MISSING,
        changeOfControl: MISSING,
        ndaConfidentiality: MISSING,
        dataComplianceObligations: MISSING,
        slaCommitments: MISSING,
      },
      thingsToWatch: [
        {
          title: "Automatic renewal window",
          severity: "HIGH",
          explanation:
            "The lease renews automatically for a further two years unless written notice is given at least three months before the Initial Term expires — miss the window and it locks in for two more years.",
          quote:
            "This Lease shall automatically renew for a further term of two (2) years commencing on expiry of the Initial Term, unless the Tenant gives the Landlord not less than three (3) months' written notice prior to expiry.",
          page: null,
          section: "Item 13, Special Condition 1,4",
        },
      ],
    },
  },
  {
    id: "msa",
    filename: "MSA_Vendor_Services.pdf",
    pages: 38,
    shortLabel: "Vendor / SaaS Agreement",
    badge: "VENDOR · SAAS",
    title: "Vendor SaaS Agreement",
    description: "Auto-renewing service terms with an early-termination fee that isn't obvious on page one.",
    analysis: {
      contractOverview: {
        contractName: { value: "Vendor SaaS Agreement", page: 1, section: "Cover Page" },
        contractType: { value: "Vendor / SaaS Services Agreement", page: 1, section: "Cover Page" },
        parties: { value: "Acme Corp × Example Vendor Services Inc.", page: 1, section: "Agreement Overview" },
        status: MISSING,
        purpose: MISSING,
      },
      importantDates: {
        startDate: MISSING,
        endDate: MISSING,
        renewalDate: { value: "14 Aug 2027", page: 2, section: "§9.1" },
        noticePeriod: { value: "90 days", page: 2, section: "§9.1" },
        noticeDeadline: MISSING,
        autoRenewal: { value: "Yes — renews automatically", page: 2, section: "§9.1" },
      },
      commercialTerms: {
        contractValue: MISSING,
        currency: MISSING,
        paymentTerms: MISSING,
        paymentFrequency: MISSING,
        pricing: MISSING,
        priceEscalation: MISSING,
        minimumCommitments: MISSING,
        latePaymentTerms: MISSING,
      },
      keyClauses: {
        termination: MISSING,
        earlyTermination: {
          value: "Early termination requires 60 days' written notice and payment of the remaining minimum-commitment fees for the current term.",
          page: null,
          section: "Section 11.2, Early Termination",
        },
        liability: MISSING,
        liabilityCap: MISSING,
        governingLaw: MISSING,
        assignment: MISSING,
        changeOfControl: MISSING,
        ndaConfidentiality: MISSING,
        dataComplianceObligations: MISSING,
        slaCommitments: MISSING,
      },
      thingsToWatch: [
        {
          title: "Early-termination fee",
          severity: "HIGH",
          explanation:
            "Terminating early isn't free — it requires 60 days' written notice plus payment of the remaining minimum-commitment fees for the current term, which isn't obvious from the renewal terms alone.",
          quote:
            "Should Customer terminate this Agreement prior to the end of the then-current term, Customer shall provide sixty (60) days' written notice and remit the aggregate of all remaining Minimum Commitment fees due for that term.",
          page: null,
          section: "Section 11.2, Early Termination",
        },
      ],
    },
  },
  {
    id: "nda",
    filename: "NDA_Mutual_Confidentiality.pdf",
    pages: 12,
    shortLabel: "Mutual NDA",
    badge: "MUTUAL NDA",
    title: "Mutual NDA",
    description: "Confidentiality obligations that outlive the agreement itself by five years.",
    analysis: {
      contractOverview: {
        contractName: { value: "Mutual Non-Disclosure Agreement", page: 1, section: "Cover Page" },
        contractType: { value: "Mutual NDA", page: 1, section: "Cover Page" },
        parties: { value: "Acme Corp × Example Consulting Partners", page: 1, section: "Recitals" },
        status: MISSING,
        purpose: {
          value: "To protect confidential information exchanged between the parties in connection with a potential business relationship.",
          page: 1,
          section: "Recitals",
        },
      },
      importantDates: {
        startDate: MISSING,
        endDate: { value: "Three (3) years from the Effective Date", page: null, section: "Section 2" },
        renewalDate: MISSING,
        noticePeriod: MISSING,
        noticeDeadline: MISSING,
        autoRenewal: MISSING,
      },
      commercialTerms: {
        contractValue: MISSING,
        currency: MISSING,
        paymentTerms: MISSING,
        paymentFrequency: MISSING,
        pricing: MISSING,
        priceEscalation: MISSING,
        minimumCommitments: MISSING,
        latePaymentTerms: MISSING,
      },
      keyClauses: {
        termination: MISSING,
        earlyTermination: MISSING,
        liability: MISSING,
        liabilityCap: MISSING,
        governingLaw: { value: "State of Delaware", page: null, section: "Section 9" },
        assignment: MISSING,
        changeOfControl: MISSING,
        ndaConfidentiality: {
          value: "Confidentiality obligations survive for five (5) years following termination or expiry of this Agreement.",
          page: null,
          section: "Section 6.3, Survival",
        },
        dataComplianceObligations: MISSING,
        slaCommitments: MISSING,
      },
      thingsToWatch: [
        {
          title: "Confidentiality survives termination",
          severity: "MEDIUM",
          explanation:
            "Confidentiality obligations don't end when the agreement does — they continue for five years after termination or expiry, so information shared today stays restricted well beyond this NDA's three-year term.",
          quote:
            "The obligations of confidentiality set out in this Agreement shall survive termination or expiry of this Agreement for a period of five (5) years.",
          page: null,
          section: "Section 6.3, Survival",
        },
      ],
    },
  },
];
