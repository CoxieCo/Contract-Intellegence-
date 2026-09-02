// GENERATED — do not edit by hand.
//
// Real output from the app's extraction pipeline (pdf-parse + Claude, same
// model/prompt as app/api/analyze/route.ts), run once over the three demo
// contract PDFs. Regenerate with scripts/generate-sample-contracts.mjs.
//
// Generated 2026-09-02T00:18:26.942Z

import type { ContractAnalysis } from "@/lib/contract-analysis";

export interface SampleContract {
  /** Stable id used as the drag payload and React key. */
  id: string;
  /** Display name shown on the card, confirm card and results header. */
  fileName: string;
  /** Short human label for the card heading (e.g. "Commercial lease"). */
  label: string;
  /** One or two sentences describing the contract, for the descriptive card. */
  blurb: string;
  /** Real page count from pdf-parse. */
  pageCount: number;
  /** Genuine parsed extraction output — drives the real ResultsView. */
  analysis: ContractAnalysis;
  /**
   * The page-marked contract text (same "--- PAGE N ---" form /api/analyze
   * persists and /api/ask consumes) so "Ask your contract" works on a sample.
   */
  contractText: string;
}

export const SAMPLE_CONTRACTS: SampleContract[] = [
  {
    "id": "lease",
    "fileName": "Commercial_Lease_Agreement.pdf",
    "label": "Commercial lease",
    "blurb": "A three-year retail lease with a fixed renewal-notice window, annual CPI-or-4% rent reviews and a holding-over penalty.",
    "pageCount": 2,
    "analysis": {
      "contractOverview": {
        "contractName": {
          "value": "Commercial Lease Agreement",
          "summary": "Commercial Lease Agreement",
          "page": 1,
          "section": null
        },
        "contractType": {
          "value": "Commercial Lease Agreement",
          "summary": "Commercial Lease Agreement",
          "page": 1,
          "section": null
        },
        "parties": {
          "value": "Harborview Property Holdings Pty Ltd (\"Landlord\"), of 88 Wharf Street, Fremantle WA 6160, and Northside Coffee Roasters Pty Ltd (\"Tenant\"), of 14 Orchard Lane, Fremantle WA 6160",
          "summary": "Harborview Property Holdings Pty Ltd and Northside Coffee Roasters Pty Ltd",
          "page": 1,
          "section": null
        },
        "status": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "purpose": {
          "value": "Landlord leases to Tenant the retail premises located at Shop 3, 88 Wharf Street, Fremantle WA 6160 (\"Premises\"), comprising approximately 95 square metres, for use as a specialty coffee retail and roasting outlet.",
          "summary": "Lease of retail premises for specialty coffee retail and roasting outlet",
          "page": 1,
          "section": "1.1"
        }
      },
      "importantDates": {
        "startDate": {
          "value": "1 April 2024",
          "summary": "1 April 2024",
          "page": 1,
          "section": "1.2"
        },
        "endDate": {
          "value": "31 March 2027",
          "summary": "31 March 2027",
          "page": 1,
          "section": "1.2"
        },
        "renewalDate": {
          "value": "31 March 2027",
          "summary": "31 March 2027",
          "page": 1,
          "section": "1.2"
        },
        "noticePeriod": {
          "value": "no earlier than nine (9) months and no later than six (6) months prior to expiry of the Initial Term",
          "summary": "Six to nine months before expiry of Initial Term",
          "page": 1,
          "section": "1.3"
        },
        "noticeDeadline": {
          "value": "six (6) months prior to expiry of the Initial Term",
          "summary": "Six months before 31 March 2027",
          "page": 1,
          "section": "1.3"
        },
        "autoRenewal": {
          "value": "If Tenant fails to provide notice within this window, the option shall lapse automatically and this Agreement shall terminate on the expiry date stated in Clause 1.2.",
          "summary": "No auto-renewal; option lapses if notice not given",
          "page": 1,
          "section": "1.3"
        }
      },
      "commercialTerms": {
        "contractValue": {
          "value": "$4,200.00 (AUD) per calendar month",
          "summary": "$4,200.00 AUD per month",
          "page": 1,
          "section": "2.1"
        },
        "currency": {
          "value": "AUD",
          "summary": "AUD",
          "page": 1,
          "section": "2.1"
        },
        "paymentTerms": {
          "value": "Tenant shall pay base rent of $4,200.00 (AUD) per calendar month, payable in advance on the first business day of each month.",
          "summary": "Monthly rent payable in advance on first business day",
          "page": 1,
          "section": "2.1"
        },
        "paymentFrequency": {
          "value": "per calendar month, payable in advance on the first business day of each month",
          "summary": "Monthly in advance",
          "page": 1,
          "section": "2.1"
        },
        "pricing": {
          "value": "Tenant shall pay base rent of $4,200.00 (AUD) per calendar month, payable in advance on the first business day of each month. In addition to base rent, Tenant shall pay Tenant's proportionate share (22%) of the Premises' outgoings, including council rates, building insurance, and common area maintenance, estimated at $680.00 per month and reconciled annually.",
          "summary": "$4,200 monthly base rent plus 22% share of outgoings",
          "page": 1,
          "section": "2.1"
        },
        "priceEscalation": {
          "value": "Base rent shall increase annually on each anniversary of the Effective Date by the greater of (a) 4% or (b) the percentage increase in the Consumer Price Index (All Groups, Perth) for the preceding twelve months.",
          "summary": "Annual increase by greater of 4% or CPI",
          "page": 1,
          "section": "2.3"
        },
        "minimumCommitments": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "latePaymentTerms": {
          "value": "If Tenant fails to pay rent within fourteen (14) days of the due date, interest shall accrue on the outstanding amount at 12% per annum, calculated daily.",
          "summary": "12% annual interest on overdue rent after 14 days",
          "page": 1,
          "section": "3.2"
        }
      },
      "keyClauses": {
        "termination": {
          "value": "Either party may terminate this Agreement prior to expiry only in accordance with Clause 3.3 (default) or by mutual written agreement.",
          "summary": "Termination only for default or mutual agreement",
          "page": 2,
          "section": "6.1"
        },
        "earlyTermination": {
          "value": "Landlord may terminate this Agreement immediately upon written notice if Tenant fails to remedy a breach within fourteen (14) days of receiving notice of that breach from Landlord.",
          "summary": "Landlord may terminate immediately for unremedied breach after 14 days",
          "page": 1,
          "section": "3.3"
        },
        "liability": {
          "value": "Landlord's total liability to Tenant arising from or in connection with this Agreement, however caused, shall not exceed the total base rent paid by Tenant in the twelve (12) months preceding the event giving rise to the claim.",
          "summary": "Landlord liability capped at 12 months base rent",
          "page": 2,
          "section": "7.2"
        },
        "liabilityCap": {
          "value": "Landlord's total liability to Tenant arising from or in connection with this Agreement, however caused, shall not exceed the total base rent paid by Tenant in the twelve (12) months preceding the event giving rise to the claim.",
          "summary": "12 months of base rent paid by Tenant",
          "page": 2,
          "section": "7.2"
        },
        "governingLaw": {
          "value": "This Agreement is governed by the laws of Western Australia. The parties submit to the exclusive jurisdiction of the courts of Western Australia.",
          "summary": "Governed by laws of Western Australia",
          "page": 2,
          "section": "8.1"
        },
        "assignment": {
          "value": "Tenant shall not assign, sublet, or otherwise transfer its interest in this Agreement without the prior written consent of Landlord, such consent not to be unreasonably withheld provided the proposed assignee has financial standing reasonably comparable to Tenant.",
          "summary": "Assignment requires Landlord consent, not unreasonably withheld",
          "page": 2,
          "section": "5.1"
        },
        "changeOfControl": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "ndaConfidentiality": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "dataComplianceObligations": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "slaCommitments": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        }
      },
      "thingsToWatch": [
        {
          "title": "Renewal notice window closes within 12 months",
          "severity": "HIGH",
          "explanation": "The Tenant must provide renewal notice no later than six months before 31 March 2027 (i.e., by 30 September 2026). Given the contract starts 1 April 2024, this deadline falls within the first 18 months of the lease term. Missing this narrow window causes the renewal option to lapse automatically, with no second chance to renew.",
          "quote": "To exercise this option, Tenant must provide Landlord with written notice no earlier than nine (9) months and no later than six (6) months prior to expiry of the Initial Term. If Tenant fails to provide notice within this window, the option shall lapse automatically and this Agreement shall terminate on the expiry date stated in Clause 1.2.",
          "page": 1,
          "section": "1.3"
        },
        {
          "title": "Uncapped annual rent escalation",
          "severity": "HIGH",
          "explanation": "Rent increases annually by the greater of 4% or CPI with no upper cap. If CPI exceeds 4%, the increase is unlimited. Over a three-year term (or six years if renewed), compounding uncapped CPI adjustments could significantly exceed typical commercial lease escalations, especially in high-inflation periods.",
          "quote": "Base rent shall increase annually on each anniversary of the Effective Date by the greater of (a) 4% or (b) the percentage increase in the Consumer Price Index (All Groups, Perth) for the preceding twelve months.",
          "page": 1,
          "section": "2.3"
        },
        {
          "title": "Asymmetric termination rights",
          "severity": "MEDIUM",
          "explanation": "Only the Landlord has an express right to terminate for breach (Clause 3.3), and only the Landlord can terminate immediately. The Tenant has no corresponding right to terminate for Landlord's breach, creating a one-sided termination mechanism that favors the Landlord.",
          "quote": "Landlord may terminate this Agreement immediately upon written notice if Tenant fails to remedy a breach within fourteen (14) days of receiving notice of that breach from Landlord.",
          "page": 1,
          "section": "3.3"
        },
        {
          "title": "Liability cap applies only to Landlord",
          "severity": "MEDIUM",
          "explanation": "The liability cap of 12 months' base rent applies only to the Landlord's liability to the Tenant. There is no corresponding cap on the Tenant's liability to the Landlord, creating an asymmetric risk allocation that leaves the Tenant exposed to unlimited liability for breach, damage, or other claims.",
          "quote": "Landlord's total liability to Tenant arising from or in connection with this Agreement, however caused, shall not exceed the total base rent paid by Tenant in the twelve (12) months preceding the event giving rise to the claim.",
          "page": 2,
          "section": "7.2"
        }
      ]
    },
    "contractText": "--- PAGE 1 ---\nCOMMERCIAL LEASE AGREEMENT\nThis Commercial Lease Agreement (\"Agreement\") is entered into as of 1 March 2024 (\"Effective Date\") by\nand between Harborview Property Holdings Pty Ltd (\"Landlord\"), of 88 Wharf Street, Fremantle WA 6160,\nand Northside Coffee Roasters Pty Ltd (\"Tenant\"), of 14 Orchard Lane, Fremantle WA 6160.\n1. Premises and Term\n1.1 Landlord leases to Tenant the retail premises located at Shop 3, 88 Wharf Street, Fremantle WA 6160\n(\"Premises\"), comprising approximately 95 square metres, for use as a specialty coffee retail and roasting\noutlet.\n1.2 The initial term of this Agreement (\"Initial Term\") shall commence on 1 April 2024 and expire on 31\nMarch 2027, a period of three (3) years.\n1.3 Renewal Option. Provided Tenant is not in default, Tenant shall have the option to renew this\nAgreement for one (1) further term of three (3) years (\"Renewal Term\") on the same terms and conditions,\nexcept that rent shall be adjusted per Clause 3.3. To exercise this option, Tenant must provide Landlord\nwith written notice no earlier than nine (9) months and no later than six (6) months prior to expiry of the\nInitial Term. If Tenant fails to provide notice within this window, the option shall lapse automatically and this\nAgreement shall terminate on the expiry date stated in Clause 1.2.\n2. Rent and Outgoings\n2.1 Tenant shall pay base rent of $4,200.00 (AUD) per calendar month, payable in advance on the first\nbusiness day of each month.\n2.2 In addition to base rent, Tenant shall pay Tenant's proportionate share (22%) of the Premises'\noutgoings, including council rates, building insurance, and common area maintenance, estimated at\n$680.00 per month and reconciled annually.\n2.3 Rent Review. Base rent shall increase annually on each anniversary of the Effective Date by the\ngreater of (a) 4% or (b) the percentage increase in the Consumer Price Index (All Groups, Perth) for the\npreceding twelve months.\n3. Security and Default\n3.1 Tenant shall provide a security bond equal to three (3) months' base rent, held by Landlord for the\nduration of the Agreement and any Renewal Term.\n3.2 If Tenant fails to pay rent within fourteen (14) days of the due date, interest shall accrue on the\noutstanding amount at 12% per annum, calculated daily.\n3.3 Landlord may terminate this Agreement immediately upon written notice if Tenant fails to remedy a\nbreach within fourteen (14) days of receiving notice of that breach from Landlord.\n4. Maintenance and Alterations\n4.1 Tenant shall maintain the interior of the Premises, including fixtures and fittings installed by Tenant, in\ngood repair throughout the Term.\n\n--- PAGE 2 ---\n4.2 Landlord shall be responsible for the structural elements of the building, including the roof, external\nwalls, and base building services.\n4.3 Tenant shall not make structural alterations to the Premises without Landlord's prior written consent,\nwhich shall not be unreasonably withheld.\n5. Assignment and Subletting\n5.1 Tenant shall not assign, sublet, or otherwise transfer its interest in this Agreement without the prior\nwritten consent of Landlord, such consent not to be unreasonably withheld provided the proposed\nassignee has financial standing reasonably comparable to Tenant.\n6. Termination and Holding Over\n6.1 Either party may terminate this Agreement prior to expiry only in accordance with Clause 3.3 (default)\nor by mutual written agreement.\n6.2 If Tenant remains in occupation of the Premises after expiry of the Term without a renewed or new\nagreement, Tenant shall be deemed a monthly tenant at a rent equal to 150% of the base rent last\npayable, until vacated.\n7. Insurance and Liability\n7.1 Tenant shall maintain public liability insurance of not less than $20,000,000 for the duration of the\nTerm, naming Landlord as an interested party.\n7.2 Landlord's total liability to Tenant arising from or in connection with this Agreement, however caused,\nshall not exceed the total base rent paid by Tenant in the twelve (12) months preceding the event giving\nrise to the claim.\n8. Governing Law\n8.1 This Agreement is governed by the laws of Western Australia. The parties submit to the exclusive\njurisdiction of the courts of Western Australia.\nIN WITNESS WHEREOF the parties have executed this Agreement as of the Effective Date first written\nabove."
  },
  {
    "id": "saas",
    "fileName": "Master_Services_Agreement.pdf",
    "label": "Vendor / SaaS agreement",
    "blurb": "A cloud platform MSA that auto-renews yearly unless cancelled 60 days out, with an SLA-credit-only remedy and a 3-month liability cap.",
    "pageCount": 2,
    "analysis": {
      "contractOverview": {
        "contractName": {
          "value": "Master Services Agreement",
          "summary": "Master Services Agreement",
          "page": 1,
          "section": null
        },
        "contractType": {
          "value": "Master Services Agreement",
          "summary": "Master Services Agreement",
          "page": 1,
          "section": null
        },
        "parties": {
          "value": "Ledgerline Technologies Inc. (\"Provider\"), and Brightfield Logistics Group Pty Ltd (\"Customer\"), of 220 Dockside Avenue, Brisbane QLD 4000",
          "summary": "Ledgerline Technologies Inc. and Brightfield Logistics Group Pty Ltd",
          "page": 1,
          "section": null
        },
        "status": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "purpose": {
          "value": "for the provision of Provider's cloud-based inventory management platform (\"Service\")",
          "summary": "Provision of cloud-based inventory management platform",
          "page": 1,
          "section": null
        }
      },
      "importantDates": {
        "startDate": {
          "value": "15 January 2025",
          "summary": "15 January 2025",
          "page": 1,
          "section": null
        },
        "endDate": {
          "value": "twelve (12) months",
          "summary": "12 months from Effective Date",
          "page": 1,
          "section": "1.1"
        },
        "renewalDate": {
          "value": "This Agreement shall automatically renew for successive twelve (12) month periods (each a \"Renewal Term\") unless either party provides written notice of non-renewal at least sixty (60) days before the end of the then-current term.",
          "summary": "Automatic 12-month renewals unless 60 days notice given",
          "page": 1,
          "section": "1.2"
        },
        "noticePeriod": {
          "value": "at least sixty (60) days before the end of the then-current term",
          "summary": "60 days before end of term",
          "page": 1,
          "section": "1.2"
        },
        "noticeDeadline": {
          "value": "at least sixty (60) days before the end of the then-current term",
          "summary": "60 days before end of term",
          "page": 1,
          "section": "1.2"
        },
        "autoRenewal": {
          "value": "This Agreement shall automatically renew for successive twelve (12) month periods (each a \"Renewal Term\") unless either party provides written notice of non-renewal at least sixty (60) days before the end of the then-current term. Customer acknowledges that failure to provide timely notice will result in automatic renewal at the then-current fees under Clause 2.",
          "summary": "Yes, automatic 12-month renewals unless notice given",
          "page": 1,
          "section": "1.2"
        }
      },
      "commercialTerms": {
        "contractValue": {
          "value": "$3,150.00 (USD)",
          "summary": "$3,150.00 USD monthly",
          "page": 1,
          "section": "2.1"
        },
        "currency": {
          "value": "USD",
          "summary": "USD",
          "page": 1,
          "section": "2.1"
        },
        "paymentTerms": {
          "value": "payable within fifteen (15) days of invoice",
          "summary": "Payment within 15 days of invoice",
          "page": 1,
          "section": "2.1"
        },
        "paymentFrequency": {
          "value": "monthly subscription fee",
          "summary": "Monthly",
          "page": 1,
          "section": "2.1"
        },
        "pricing": {
          "value": "a monthly subscription fee of $3,150.00 (USD)",
          "summary": "$3,150.00 USD per month",
          "page": 1,
          "section": "2.1"
        },
        "priceEscalation": {
          "value": "Provider may increase the subscription fee upon renewal by providing at least thirty (30) days' written notice. If Customer does not accept the increased fee, Customer's sole remedy is to decline renewal under Clause 1.2; continued use of the Service after a price increase takes effect constitutes acceptance.",
          "summary": "Provider may increase fees upon renewal with 30 days notice",
          "page": 1,
          "section": "2.2"
        },
        "minimumCommitments": {
          "value": "twelve (12) months",
          "summary": "12 months initial term",
          "page": 1,
          "section": "1.1"
        },
        "latePaymentTerms": {
          "value": "Late payments accrue interest at 1.5% per month and may result in suspension of Service access after ten (10) days' notice.",
          "summary": "1.5% monthly interest; suspension after 10 days notice",
          "page": 1,
          "section": "2.3"
        }
      },
      "keyClauses": {
        "termination": {
          "value": "Either party may terminate this Agreement for material breach not cured within thirty (30) days of written notice.",
          "summary": "Either party may terminate for uncured material breach",
          "page": 2,
          "section": "7.1"
        },
        "earlyTermination": {
          "value": "Provider may suspend or terminate Customer's access immediately, without prior notice, if Provider reasonably believes Customer's use of the Service poses a security risk to Provider's infrastructure or other customers.",
          "summary": "Provider may terminate immediately for security risk",
          "page": 2,
          "section": "7.2"
        },
        "liability": {
          "value": "Except for breaches of Section 6 (Confidentiality), Provider's total aggregate liability arising out of or related to this Agreement shall not exceed the fees paid by Customer in the three (3) months immediately preceding the claim.",
          "summary": "Provider liability capped at 3 months fees except confidentiality",
          "page": 2,
          "section": "5.1"
        },
        "liabilityCap": {
          "value": "Except for breaches of Section 6 (Confidentiality), Provider's total aggregate liability arising out of or related to this Agreement shall not exceed the fees paid by Customer in the three (3) months immediately preceding the claim.",
          "summary": "3 months of fees, excluding confidentiality breaches",
          "page": 2,
          "section": "5.1"
        },
        "governingLaw": {
          "value": "This Agreement is governed by the laws of the State of Delaware, without regard to conflict of law principles.",
          "summary": "Delaware law",
          "page": 2,
          "section": "8.1"
        },
        "assignment": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "changeOfControl": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "ndaConfidentiality": {
          "value": "Each party shall protect the other's Confidential Information using the same degree of care it uses for its own confidential information, and in no event less than reasonable care, for a period of five (5) years following disclosure.",
          "summary": "5-year confidentiality obligation with reasonable care standard",
          "page": 2,
          "section": "6.1"
        },
        "dataComplianceObligations": {
          "value": "Provider shall maintain industry-standard technical and organisational measures to protect Customer Data.",
          "summary": "Industry-standard measures to protect Customer Data",
          "page": 1,
          "section": "4.1"
        },
        "slaCommitments": {
          "value": "Provider shall use commercially reasonable efforts to maintain 99.5% uptime, measured monthly, excluding scheduled maintenance.",
          "summary": "99.5% uptime commitment, measured monthly",
          "page": 1,
          "section": "3.1"
        }
      },
      "thingsToWatch": [
        {
          "title": "Uncapped price escalation upon renewal",
          "severity": "HIGH",
          "explanation": "Provider may increase subscription fees upon renewal with no cap or limit stated. The only remedy for Customer is to decline renewal, which requires 60 days notice. This allows unlimited price increases at each 12-month renewal cycle.",
          "quote": "Provider may increase the subscription fee upon renewal by providing at least thirty (30) days' written notice. If Customer does not accept the increased fee, Customer's sole remedy is to decline renewal under Clause 1.2; continued use of the Service after a price increase takes effect constitutes acceptance.",
          "page": 1,
          "section": "2.2"
        },
        {
          "title": "Liability cap below 12 months of fees",
          "severity": "HIGH",
          "explanation": "Provider's liability is capped at only 3 months of fees (approximately $9,450 USD), which is below the 12-month threshold. This cap applies to all claims except confidentiality breaches, while Customer's liability for unpaid fees is explicitly uncapped.",
          "quote": "Except for breaches of Section 6 (Confidentiality), Provider's total aggregate liability arising out of or related to this Agreement shall not exceed the fees paid by Customer in the three (3) months immediately preceding the claim.",
          "page": 2,
          "section": "5.1"
        },
        {
          "title": "One-sided immediate termination right",
          "severity": "MEDIUM",
          "explanation": "Provider has the unilateral right to suspend or terminate Customer's access immediately without prior notice based on Provider's reasonable belief of a security risk. Customer has no equivalent right and must follow the 30-day cure process for material breach.",
          "quote": "Provider may suspend or terminate Customer's access immediately, without prior notice, if Provider reasonably believes Customer's use of the Service poses a security risk to Provider's infrastructure or other customers.",
          "page": 2,
          "section": "7.2"
        },
        {
          "title": "Automatic renewal with no cap on cycles",
          "severity": "MEDIUM",
          "explanation": "The Agreement automatically renews for successive 12-month periods with no limit on the number of renewal cycles. Customer must affirmatively act to prevent renewal by providing 60 days notice, and failure to do so results in automatic renewal at Provider's then-current fees.",
          "quote": "This Agreement shall automatically renew for successive twelve (12) month periods (each a \"Renewal Term\") unless either party provides written notice of non-renewal at least sixty (60) days before the end of the then-current term. Customer acknowledges that failure to provide timely notice will result in automatic renewal at the then-current fees under Clause 2.",
          "page": 1,
          "section": "1.2"
        }
      ]
    },
    "contractText": "--- PAGE 1 ---\nMASTER SERVICES AGREEMENT\nThis Master Services Agreement (\"Agreement\") is made as of 15 January 2025 (\"Effective Date\") between\nLedgerline Technologies Inc. (\"Provider\"), and Brightfield Logistics Group Pty Ltd (\"Customer\"), of 220\nDockside Avenue, Brisbane QLD 4000, for the provision of Provider's cloud-based inventory management\nplatform (\"Service\").\n1. Term\n1.1 This Agreement commences on the Effective Date and continues for an initial term of twelve (12)\nmonths (\"Initial Term\").\n1.2 Auto-Renewal. This Agreement shall automatically renew for successive twelve (12) month periods\n(each a \"Renewal Term\") unless either party provides written notice of non-renewal at least sixty (60) days\nbefore the end of the then-current term. Customer acknowledges that failure to provide timely notice will\nresult in automatic renewal at the then-current fees under Clause 2.\n2. Fees and Payment\n2.1 Customer shall pay a monthly subscription fee of $3,150.00 (USD), payable within fifteen (15) days of\ninvoice.\n2.2 Price Increases. Provider may increase the subscription fee upon renewal by providing at least thirty\n(30) days' written notice. If Customer does not accept the increased fee, Customer's sole remedy is to\ndecline renewal under Clause 1.2; continued use of the Service after a price increase takes effect\nconstitutes acceptance.\n2.3 Late payments accrue interest at 1.5% per month and may result in suspension of Service access after\nten (10) days' notice.\n3. Service Levels\n3.1 Provider shall use commercially reasonable efforts to maintain 99.5% uptime, measured monthly,\nexcluding scheduled maintenance.\n3.2 If Provider fails to meet the uptime commitment in Clause 3.1, Customer's sole and exclusive remedy\nis a service credit equal to 5% of that month's fee for each full percentage point below the commitment, up\nto a maximum credit of 25% of the monthly fee. No other remedy, including termination or damages, shall\nbe available for a Service Level failure alone.\n4. Data and Security\n4.1 Provider shall maintain industry-standard technical and organisational measures to protect Customer\nData.\n4.2 Upon termination, Provider shall make Customer Data available for export for thirty (30) days, after\nwhich it may be permanently deleted.\n5. Limitation of Liability\n\n--- PAGE 2 ---\n5.1 Except for breaches of Section 6 (Confidentiality), Provider's total aggregate liability arising out of or\nrelated to this Agreement shall not exceed the fees paid by Customer in the three (3) months immediately\npreceding the claim.\n5.2 In no event shall either party be liable for indirect, incidental, consequential, or punitive damages,\nincluding lost profits, even if advised of the possibility of such damages.\n5.3 Notwithstanding Clause 5.1, Customer's liability for unpaid fees under Clause 2 is uncapped.\n6. Confidentiality\n6.1 Each party shall protect the other's Confidential Information using the same degree of care it uses for\nits own confidential information, and in no event less than reasonable care, for a period of five (5) years\nfollowing disclosure.\n7. Termination\n7.1 Either party may terminate this Agreement for material breach not cured within thirty (30) days of\nwritten notice.\n7.2 Provider may suspend or terminate Customer's access immediately, without prior notice, if Provider\nreasonably believes Customer's use of the Service poses a security risk to Provider's infrastructure or\nother customers.\n8. Governing Law\n8.1 This Agreement is governed by the laws of the State of Delaware, without regard to conflict of law\nprinciples.\nIN WITNESS WHEREOF the parties have executed this Agreement as of the Effective Date."
  },
  {
    "id": "nda",
    "fileName": "Mutual_NDA.pdf",
    "label": "Mutual NDA",
    "blurb": "A two-year mutual non-disclosure agreement whose confidentiality obligations survive for seven years from disclosure.",
    "pageCount": 2,
    "analysis": {
      "contractOverview": {
        "contractName": {
          "value": "Mutual Non-Disclosure Agreement",
          "summary": "Mutual Non-Disclosure Agreement",
          "page": 1,
          "section": null
        },
        "contractType": {
          "value": "Mutual Non-Disclosure Agreement",
          "summary": "Mutual Non-Disclosure Agreement",
          "page": 1,
          "section": null
        },
        "parties": {
          "value": "Solstice Robotics Pty Ltd (\"Party A\"), of 12 Innovation Way, Melbourne VIC 3000, and Kestrel Manufacturing Co. (\"Party B\"), of 400 Industrial Parkway, Geelong VIC 3220",
          "summary": "Solstice Robotics Pty Ltd and Kestrel Manufacturing Co.",
          "page": 1,
          "section": null
        },
        "status": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "purpose": {
          "value": "in connection with a potential business relationship regarding automated assembly-line technology (the \"Purpose\")",
          "summary": "Potential business relationship regarding automated assembly-line technology",
          "page": 1,
          "section": null
        }
      },
      "importantDates": {
        "startDate": {
          "value": "3 June 2025",
          "summary": "3 June 2025",
          "page": 1,
          "section": null
        },
        "endDate": {
          "value": "This Agreement commences on the Effective Date and continues for two (2) years, unless earlier terminated by either party on thirty (30) days' written notice.",
          "summary": "Two years from 3 June 2025",
          "page": 1,
          "section": "3.1"
        },
        "renewalDate": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "noticePeriod": {
          "value": "thirty (30) days' written notice",
          "summary": "30 days written notice",
          "page": 1,
          "section": "3.1"
        },
        "noticeDeadline": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "autoRenewal": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        }
      },
      "commercialTerms": {
        "contractValue": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "currency": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "paymentTerms": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "paymentFrequency": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "pricing": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "priceEscalation": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "minimumCommitments": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "latePaymentTerms": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        }
      },
      "keyClauses": {
        "termination": {
          "value": "This Agreement commences on the Effective Date and continues for two (2) years, unless earlier terminated by either party on thirty (30) days' written notice.",
          "summary": "Either party may terminate on 30 days written notice",
          "page": 1,
          "section": "3.1"
        },
        "earlyTermination": {
          "value": "This Agreement commences on the Effective Date and continues for two (2) years, unless earlier terminated by either party on thirty (30) days' written notice.",
          "summary": "Either party may terminate on 30 days written notice",
          "page": 1,
          "section": "3.1"
        },
        "liability": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "liabilityCap": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "governingLaw": {
          "value": "This Agreement is governed by the laws of the State of Victoria, Australia.",
          "summary": "Laws of the State of Victoria, Australia",
          "page": 2,
          "section": "7.2"
        },
        "assignment": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "changeOfControl": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "ndaConfidentiality": {
          "value": "Each party shall use the other party's Confidential Information solely for the Purpose and shall not disclose it to any third party without prior written consent, except to employees and advisors with a genuine need to know who are bound by confidentiality obligations at least as protective as this Agreement.",
          "summary": "Use only for Purpose; no disclosure without consent except to bound employees/advisors",
          "page": 1,
          "section": "2.1"
        },
        "dataComplianceObligations": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        },
        "slaCommitments": {
          "value": "Not found",
          "summary": "Not found",
          "page": null,
          "section": null
        }
      },
      "thingsToWatch": [
        {
          "title": "Confidentiality obligations survive 7 years",
          "severity": "MEDIUM",
          "explanation": "The confidentiality obligations survive termination for seven years from the date of disclosure, which is significantly longer than the two-year term of the Agreement itself. This creates an uncapped, long-term compliance burden that extends well beyond the relationship and may be difficult to track and enforce, particularly if disclosures occur throughout the two-year term.",
          "quote": "The confidentiality obligations set out in Section 2 shall survive termination or expiry of this Agreement and continue to bind each party for a period of seven (7) years from the date of disclosure of the relevant Confidential Information, regardless of when this Agreement itself terminates.",
          "page": 1,
          "section": "3.2"
        }
      ]
    },
    "contractText": "--- PAGE 1 ---\nMUTUAL NON-DISCLOSURE AGREEMENT\nThis Mutual Non-Disclosure Agreement (\"Agreement\") is entered into as of 3 June 2025 between Solstice\nRobotics Pty Ltd (\"Party A\"), of 12 Innovation Way, Melbourne VIC 3000, and Kestrel Manufacturing Co.\n(\"Party B\"), of 400 Industrial Parkway, Geelong VIC 3220, in connection with a potential business\nrelationship regarding automated assembly-line technology (the \"Purpose\").\n1. Definition of Confidential Information\n1.1 \"Confidential Information\" means any technical, business, financial, or other information disclosed by\neither party, whether orally, in writing, or by inspection, that is designated as confidential or that a\nreasonable person would understand to be confidential given the nature of the information and the\ncircumstances of disclosure. Confidential Information includes, without limitation, product designs, source\ncode, pricing, customer lists, and manufacturing processes.\n1.2 Confidential Information does not include information that: (a) is or becomes publicly available through\nno fault of the receiving party; (b) was rightfully known to the receiving party prior to disclosure; (c) is\nindependently developed without use of the disclosing party's Confidential Information; or (d) is rightfully\nreceived from a third party without duty of confidentiality.\n2. Obligations\n2.1 Each party shall use the other party's Confidential Information solely for the Purpose and shall not\ndisclose it to any third party without prior written consent, except to employees and advisors with a genuine\nneed to know who are bound by confidentiality obligations at least as protective as this Agreement.\n2.2 Each party shall protect the other's Confidential Information using at least the same degree of care it\nuses to protect its own confidential information of similar importance, and in no event less than a\nreasonable standard of care.\n3. Term and Survival\n3.1 This Agreement commences on the Effective Date and continues for two (2) years, unless earlier\nterminated by either party on thirty (30) days' written notice.\n3.2 The confidentiality obligations set out in Section 2 shall survive termination or expiry of this Agreement\nand continue to bind each party for a period of seven (7) years from the date of disclosure of the relevant\nConfidential Information, regardless of when this Agreement itself terminates.\n4. No License; No Obligation\n4.1 Nothing in this Agreement grants either party any license or ownership right in the other's Confidential\nInformation, intellectual property, or any related patents, trademarks, or copyrights.\n4.2 Neither party is obligated by this Agreement to disclose any particular information, nor to enter into any\nfurther business relationship.\n5. Return or Destruction\n\n--- PAGE 2 ---\n5.1 Upon written request or termination of this Agreement, each party shall promptly return or destroy all\nmaterials containing the other party's Confidential Information, and certify such destruction in writing if\nrequested, except that one archival copy may be retained solely for legal compliance purposes.\n6. Remedies\n6.1 Each party acknowledges that unauthorised disclosure of Confidential Information may cause\nirreparable harm for which monetary damages would be an inadequate remedy, and that the disclosing\nparty shall be entitled to seek injunctive relief in addition to any other remedies available at law or in equity.\n7. General\n7.1 This Agreement constitutes the entire agreement between the parties regarding its subject matter and\nsupersedes all prior discussions or agreements on that subject.\n7.2 This Agreement is governed by the laws of the State of Victoria, Australia.\nIN WITNESS WHEREOF the parties have executed this Agreement as of the date first written above."
  }
];
