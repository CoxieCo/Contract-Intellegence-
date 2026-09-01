// The 3 canned contracts behind the hero demo's sample cards. Each is a
// fully scripted (not real) analysis used only to drive HeroDemo's illustrative
// scan/extract/ask animation — no PDF is ever read or stored for these.

export interface DemoField {
  l: string;
  v: string;
  c: string;
}

export interface DemoContract {
  id: string;
  filename: string;
  pages: number;
  fields: DemoField[];
  askQ: string;
  answerText: string;
  answerCite: string;
}

export const SAMPLE_CONTRACTS: DemoContract[] = [
  {
    id: "msa",
    filename: "MSA_Vendor_Services.pdf",
    pages: 38,
    fields: [
      { l: "Renewal date", v: "14 Aug 2027", c: "§9.1" },
      { l: "Notice period", v: "90 days", c: "§9.1" },
      { l: "Renewal term", v: "Two (2) years commencing on expiry of the Initial Term", c: "Item 13, Special Condition 1,4" },
      { l: "Auto-renewal", v: "Yes — renews automatically", c: "Page 2" },
    ],
    askQ: "What happens if we terminate early?",
    answerText:
      "Early termination requires 60 days’ written notice and payment of the remaining minimum-commitment fees for the current term.",
    answerCite: "Section 11.2, Early Termination",
  },
  {
    id: "lease",
    filename: "Retail_Lease_Agreement.pdf",
    pages: 62,
    fields: [
      { l: "Renewal term", v: "Two (2) years commencing on expiry of the Initial Term", c: "Item 13, Special Condition 1,4" },
      { l: "Notice period", v: "Not less than three (3) months prior to expiry", c: "Special Condition 4.2" },
      { l: "Parties", v: "Acme Corp × Landlord Pty Ltd", c: "Agreement Overview" },
      { l: "Rent review", v: "CPI-linked, reviewed annually", c: "Item 9" },
    ],
    askQ: "When does this agreement renew?",
    answerText:
      "On expiry of the Initial Term, the lease renews automatically for a further two (2) years unless written notice is given at least three months prior to expiry.",
    answerCite: "Item 13, Special Condition 1,4",
  },
  {
    id: "nda",
    filename: "NDA_Mutual_Confidentiality.pdf",
    pages: 12,
    fields: [
      { l: "Term", v: "Three (3) years from the Effective Date", c: "Section 2" },
      { l: "Confidentiality survival", v: "5 years following termination or expiry", c: "Section 6.3" },
      { l: "Governing law", v: "State of Delaware", c: "Section 9" },
      { l: "Permitted disclosure", v: "Employees and advisors under equivalent obligations", c: "Section 3.2" },
    ],
    askQ: "How long do confidentiality obligations last?",
    answerText: "Confidentiality obligations survive for five (5) years following termination or expiry of this Agreement.",
    answerCite: "Section 6.3, Survival",
  },
];
