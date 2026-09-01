import type { ContractAnalysis } from "@/lib/contract-analysis";

// The 3 sample contracts behind the landing page's "Pick a sample contract"
// section (SampleScanSection). Each carries a full, fully scripted (not
// real) ContractAnalysis — the exact same shape /api/analyze produces — so
// the sample flow can feed it straight into the real ScanningView and
// ResultsView components instead of a lookalike animation. No PDF is ever
// read, stored, or uploaded for these; `fileSizeBytes` only exists to print
// a plausible size on the confirm card.

export interface DemoContract {
  id: string;
  filename: string;
  pages: number;
  fileSizeBytes: number;
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
    fileSizeBytes: 2_540_000,
    shortLabel: "Retail Lease",
    badge: "COMMERCIAL LEASE",
    title: "Retail Lease Agreement",
    description: "A renewal window that opens automatically — miss the notice period and you're locked in for two more years.",
    analysis: {
      contractOverview: {
        contractName: { value: "Retail Lease Agreement", page: 1, section: "Agreement Overview" },
        contractType: { value: "Commercial Lease", page: 1, section: "Agreement Overview" },
        parties: {
          value: "Acme Corp (\"Tenant\") and Landlord Pty Ltd (\"Landlord\")",
          summary: "Acme Corp × Landlord Pty Ltd",
          page: 1,
          section: "Agreement Overview",
        },
        status: { value: "Active", page: 1, section: "Agreement Overview" },
        purpose: {
          value: "Lease of retail premises for the Tenant's retail operations, on the terms set out in this Agreement and its Special Conditions.",
          summary: "Lease of retail premises for the Tenant's retail operations.",
          page: 2,
          section: "Recitals",
        },
      },
      importantDates: {
        startDate: { value: "18 Mar 2025", page: 1, section: "Item 4" },
        endDate: { value: "17 Mar 2027", page: 1, section: "Item 5" },
        renewalDate: {
          value: "Two (2) years commencing on expiry of the Initial Term",
          summary: "Renews for a further 2 years on expiry of the Initial Term",
          page: 4,
          section: "Item 13, Special Condition 1,4",
        },
        noticePeriod: { value: "Not less than three (3) months prior to expiry of the then-current term", page: 5, section: "Special Condition 4.2" },
        noticeDeadline: { value: "17 Dec 2026", page: 5, section: "Special Condition 4.2" },
        autoRenewal: {
          value: "Renews automatically for a further two (2) years unless written notice is given at least three months prior to expiry",
          summary: "Yes — renews automatically unless notice is given",
          page: 4,
          section: "Item 13, Special Condition 1,4",
        },
      },
      commercialTerms: {
        contractValue: { value: "Not found", page: null, section: null },
        currency: { value: "USD", page: 6, section: "Item 8" },
        paymentTerms: { value: "Rent payable monthly in advance, on the first day of each month", page: 6, section: "Item 8" },
        paymentFrequency: { value: "Monthly", page: 6, section: "Item 8" },
        pricing: { value: "Not found", page: null, section: null },
        priceEscalation: {
          value: "Rent reviewed annually on each anniversary of the Commencement Date, adjusted in line with the Consumer Price Index",
          summary: "CPI-linked, reviewed annually",
          page: 7,
          section: "Item 9",
        },
        minimumCommitments: { value: "Not found", page: null, section: null },
        latePaymentTerms: { value: "Interest accrues at 8% per annum on any rent more than 5 business days overdue", page: 8, section: "Item 10" },
      },
      keyClauses: {
        termination: {
          value: "Either party may terminate this Agreement for an uncured material breach following 30 days' written notice",
          summary: "Either party may terminate for uncured material breach after 30 days' notice",
          page: 40,
          section: "Section 14",
        },
        earlyTermination: { value: "Not found", page: null, section: null },
        liability: {
          value: "The Tenant is liable for damage to the premises beyond fair wear and tear",
          page: 42,
          section: "Section 16",
        },
        liabilityCap: { value: "Not found", page: null, section: null },
        governingLaw: { value: "State of New South Wales", page: 55, section: "Section 22" },
        assignment: {
          value: "The Tenant may not assign, sublet, or otherwise transfer its interest in this lease without the Landlord's prior written consent",
          summary: "Assignment requires the Landlord's prior written consent",
          page: 44,
          section: "Section 17",
        },
        changeOfControl: { value: "Not found", page: null, section: null },
        ndaConfidentiality: { value: "Not found", page: null, section: null },
        dataComplianceObligations: { value: "Not found", page: null, section: null },
        slaCommitments: { value: "Not found", page: null, section: null },
      },
      thingsToWatch: [
        {
          title: "Conditional renewal mechanism",
          severity: "HIGH",
          explanation:
            "Renewal is tied to expiry of the Initial Term and requires notice at least three months out — the deadline moves with the term, so it's easy to miss without a tracked reminder.",
          quote:
            "the lease renews automatically for a further two (2) years unless written notice is given at least three months prior to expiry",
          page: 4,
          section: "Item 13, Special Condition 1,4",
        },
        {
          title: "CPI-linked rent escalation",
          severity: "MEDIUM",
          explanation: "Rent increases annually with CPI rather than a fixed schedule, making next year's rent harder to budget for in advance.",
          quote: "Rent reviewed annually on each anniversary of the Commencement Date, adjusted in line with the Consumer Price Index",
          page: 7,
          section: "Item 9",
        },
        {
          title: "No cap on tenant liability for damage",
          severity: "LOW",
          explanation: "Liability for damage beyond fair wear and tear is uncapped, unlike the liability caps common in vendor agreements.",
          quote: "The Tenant is liable for damage to the premises beyond fair wear and tear",
          page: 42,
          section: "Section 16",
        },
      ],
    },
  },
  {
    id: "msa",
    filename: "MSA_Vendor_Services.pdf",
    pages: 38,
    fileSizeBytes: 1_640_000,
    shortLabel: "Vendor / SaaS Agreement",
    badge: "VENDOR · SAAS",
    title: "Vendor SaaS Agreement",
    description: "Auto-renewing service terms with an early-termination fee that isn't obvious on page one.",
    analysis: {
      contractOverview: {
        contractName: { value: "Master Services Agreement — Vendor SaaS Platform", summary: "Vendor SaaS Master Services Agreement", page: 1, section: "Agreement Overview" },
        contractType: { value: "SaaS / Vendor Services Agreement", page: 1, section: "Agreement Overview" },
        parties: { value: "Customer and Vendor Inc.", page: 1, section: "Agreement Overview" },
        status: { value: "Active", page: 1, section: "Agreement Overview" },
        purpose: {
          value: "Provision of a SaaS platform and related support services to Customer under a subscription model.",
          page: 2,
          section: "Recitals",
        },
      },
      importantDates: {
        startDate: { value: "14 Aug 2025", page: 1, section: "§1.1" },
        endDate: { value: "13 Aug 2027", page: 1, section: "§1.1" },
        renewalDate: { value: "14 Aug 2027", page: 9, section: "§9.1" },
        noticePeriod: { value: "90 days", page: 9, section: "§9.1" },
        noticeDeadline: { value: "16 May 2027", page: 9, section: "§9.1" },
        autoRenewal: {
          value: "Renews automatically for a further two (2) years commencing on expiry of the Initial Term",
          summary: "Yes — renews automatically",
          page: 9,
          section: "§9.1",
        },
      },
      commercialTerms: {
        contractValue: { value: "$180,000 per annum", page: 11, section: "Schedule A" },
        currency: { value: "USD", page: 11, section: "Schedule A" },
        paymentTerms: { value: "Net 30 from invoice date", page: 12, section: "§7.1" },
        paymentFrequency: { value: "Monthly", page: 12, section: "§7.1" },
        pricing: { value: "Tiered per-seat pricing based on active user count", page: 11, section: "Schedule A" },
        priceEscalation: { value: "Annual price increase capped at 5% of the prior year's fees", summary: "Annual increase capped at 5%", page: 12, section: "§7.3" },
        minimumCommitments: { value: "Minimum of 50 licensed seats for the Initial Term", summary: "Minimum of 50 licensed seats", page: 11, section: "Schedule A" },
        latePaymentTerms: { value: "1.5% monthly interest on invoices unpaid more than 15 days past due", page: 13, section: "§7.4" },
      },
      keyClauses: {
        termination: {
          value: "Either party may terminate this Agreement for an uncured material breach following 30 days' written notice",
          summary: "Either party may terminate for uncured material breach after 30 days' notice",
          page: 20,
          section: "§11.1",
        },
        earlyTermination: {
          value: "Early termination requires 60 days' written notice and payment of the remaining minimum-commitment fees for the current term.",
          page: 22,
          section: "Section 11.2, Early Termination",
        },
        liability: { value: "Liability is limited to direct damages only; no liability for indirect or consequential loss", summary: "Limited to direct damages only", page: 25, section: "§13.1" },
        liabilityCap: { value: "Capped at the total fees paid in the 12 months preceding the claim", summary: "Capped at 12 months' fees paid", page: 25, section: "§13.2" },
        governingLaw: { value: "State of Delaware", page: 36, section: "§18.1" },
        assignment: {
          value: "Neither party may assign this Agreement without the other's consent, except to an acquirer of substantially all its assets",
          summary: "Neither party may assign without consent, except to an acquirer",
          page: 27,
          section: "§14.1",
        },
        changeOfControl: { value: "Vendor may terminate this Agreement on 30 days' notice following Customer's change of control", summary: "Vendor may terminate on Customer's change of control", page: 28, section: "§14.2" },
        ndaConfidentiality: { value: "Confidentiality obligations survive three (3) years following termination of this Agreement", summary: "Mutual confidentiality, survives 3 years post-termination", page: 30, section: "§15.1" },
        dataComplianceObligations: { value: "Vendor shall maintain SOC 2 Type II certification for the duration of this Agreement", summary: "Vendor maintains SOC 2 Type II certification", page: 32, section: "§16.1" },
        slaCommitments: { value: "99.9% monthly uptime, with service credits for any shortfall", summary: "99.9% uptime SLA with service credits", page: 18, section: "§10.1" },
      },
      thingsToWatch: [
        {
          title: "Auto-renewal with a narrow notice window",
          severity: "HIGH",
          explanation: "The contract renews automatically for two more years unless notice is given 90 days before the renewal date — easy to miss without a tracked reminder.",
          quote: "Renews automatically for a further two (2) years commencing on expiry of the Initial Term",
          page: 9,
          section: "§9.1",
        },
        {
          title: "Early-termination fee isn't upfront",
          severity: "MEDIUM",
          explanation: "Exiting early costs 60 days' notice plus the remaining minimum-commitment fees for the current term — worth budgeting for before signing, not after deciding to leave.",
          quote: "Early termination requires 60 days' written notice and payment of the remaining minimum-commitment fees for the current term.",
          page: 22,
          section: "Section 11.2, Early Termination",
        },
        {
          title: "Minimum seat commitment regardless of usage",
          severity: "LOW",
          explanation: "Fees are based on a 50-seat minimum for the full term even if actual usage falls below that.",
          quote: "Minimum of 50 licensed seats for the Initial Term",
          page: 11,
          section: "Schedule A",
        },
      ],
    },
  },
  {
    id: "nda",
    filename: "NDA_Mutual_Confidentiality.pdf",
    pages: 12,
    fileSizeBytes: 380_000,
    shortLabel: "Mutual NDA",
    badge: "MUTUAL NDA",
    title: "Mutual NDA",
    description: "Confidentiality obligations that outlive the agreement itself by five years.",
    analysis: {
      contractOverview: {
        contractName: { value: "Mutual Non-Disclosure Agreement", page: 1, section: "Agreement Overview" },
        contractType: { value: "NDA / Confidentiality Agreement", page: 1, section: "Agreement Overview" },
        parties: { value: "Company A and Company B", page: 1, section: "Agreement Overview" },
        status: { value: "Active", page: 1, section: "Agreement Overview" },
        purpose: {
          value: "To protect confidential information exchanged between the parties in connection with a potential business relationship.",
          summary: "Protects confidential information shared in a potential business relationship",
          page: 1,
          section: "Recitals",
        },
      },
      importantDates: {
        startDate: { value: "1 Jan 2025", page: 1, section: "Section 1" },
        endDate: { value: "31 Dec 2027", page: 1, section: "Section 2" },
        renewalDate: { value: "Not found", page: null, section: null },
        noticePeriod: { value: "Not found", page: null, section: null },
        noticeDeadline: { value: "Not found", page: null, section: null },
        autoRenewal: { value: "Not found", page: null, section: null },
      },
      commercialTerms: {
        contractValue: { value: "Not found", page: null, section: null },
        currency: { value: "Not found", page: null, section: null },
        paymentTerms: { value: "Not found", page: null, section: null },
        paymentFrequency: { value: "Not found", page: null, section: null },
        pricing: { value: "Not found", page: null, section: null },
        priceEscalation: { value: "Not found", page: null, section: null },
        minimumCommitments: { value: "Not found", page: null, section: null },
        latePaymentTerms: { value: "Not found", page: null, section: null },
      },
      keyClauses: {
        termination: { value: "Either party may terminate this Agreement on 30 days' written notice", page: 8, section: "Section 7" },
        earlyTermination: { value: "Not found", page: null, section: null },
        liability: { value: "Not found", page: null, section: null },
        liabilityCap: { value: "Not found", page: null, section: null },
        governingLaw: { value: "State of Delaware", page: 9, section: "Section 9" },
        assignment: { value: "This Agreement is not assignable by either party without the other's prior written consent", summary: "Not assignable without prior written consent", page: 10, section: "Section 10" },
        changeOfControl: { value: "Not found", page: null, section: null },
        ndaConfidentiality: {
          value: "Confidentiality obligations survive for five (5) years following termination or expiry of this Agreement",
          summary: "Survives 5 years following termination or expiry",
          page: 6,
          section: "Section 6.3, Survival",
        },
        dataComplianceObligations: { value: "Not found", page: null, section: null },
        slaCommitments: { value: "Not found", page: null, section: null },
      },
      thingsToWatch: [
        {
          title: "Confidentiality survives well beyond the agreement's term",
          severity: "HIGH",
          explanation: "Obligations don't end when the agreement does — anything shared under this NDA stays confidential for 5 more years, long after the underlying deal may be forgotten.",
          quote: "Confidentiality obligations survive for five (5) years following termination or expiry of this Agreement",
          page: 6,
          section: "Section 6.3, Survival",
        },
        {
          title: "Broad permitted-disclosure carve-out",
          severity: "MEDIUM",
          explanation: "Confidential information can be shared with any employee or advisor, provided they're bound by equivalent obligations — worth confirming that's actually enforced in practice.",
          quote: "Employees and advisors under equivalent obligations",
          page: 3,
          section: "Section 3.2",
        },
      ],
    },
  },
];
