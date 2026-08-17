# Contract Analysis Extraction Specification

This document defines exactly what information the AI contract scanner should extract from every contract. It is the single source of truth for:

1. The structured JSON schema (Point 2)
2. The AI's analysis instructions/prompt
3. The Contract Analysis dashboard UI
4. Validation of AI responses
5. Future features: contract search, reminders, risk detection, "Ask Your Contract"

---

## 1. Contract Overview

Fields:
- Contract name/title
- Contract type
- Parties involved
- Contract status
- Short description/purpose of the contract

Example:
```
Contract Name: Master Services Agreement
Contract Type: Service Agreement
Parties: Company A, Company B
Status: Active
Purpose: Provides software services to Company A.
```

---

## 2. Important Dates

Fields:
- Effective/start date
- End/expiration date
- Renewal date
- Notice period
- Notice deadline
- Auto-renewal

Example:
```
Start Date: 14 August 2026
End Date: 14 August 2027
Renewal Date: 14 August 2027
Notice Period: 90 days
Auto-Renewal: Yes
```

These fields are extremely important — one of the main purposes of the SaaS is helping businesses avoid missing contract renewals and notice deadlines.

---

## 3. Commercial Terms

Fields:
- Contract value
- Currency
- Payment terms
- Payment frequency
- Pricing
- Price escalation/increases
- Minimum commitments
- Late-payment terms

Example:
```
Contract Value: $24,000/year
Payment Terms: 30 days
Price Escalation: 3% annually
Minimum Commitment: 12 months
```

---

## 4. Key Clauses

Fields (identify and summarize):
- Termination
- Early termination
- Liability
- Liability cap
- Governing law
- Assignment
- Change of control
- NDA/confidentiality
- Data/compliance obligations
- SLA commitments

Example:
```
Termination: Either party may terminate with 90 days' written notice.
Liability: Liability is capped at $100,000.
Governing Law: Queensland, Australia.
SLA: 99.9% uptime commitment.
```

Purpose: surface clauses that an operations manager or business decision-maker would normally have to search through the entire contract to find.

---

## 5. Things to Watch

A section identifying contract provisions that may require attention or review.

Potential examples:
- Upcoming renewal
- Short notice deadlines
- Automatic renewal
- Large price increases
- Long minimum commitments
- Difficult termination conditions
- Significant contractual obligations
- Liability provisions worth reviewing
- Unusual or important contractual conditions

Each item contains:
- Title
- Severity
- Explanation

Example:
```
Severity: HIGH
Title: Automatic Renewal
Explanation: The contract automatically renews unless notice is provided at least 90 days before renewal.
```

**Important:** Do not describe something as legally invalid, illegal, or definitively "bad" unless the system is specifically designed and qualified to make that determination. Frame items as:
- "Things to Watch"
- "Items Requiring Attention"
- "Provisions Worth Reviewing"

...rather than definitive legal conclusions.

---

## Master Extraction List

**Contract Overview**
- Contract name
- Contract type
- Parties
- Status
- Purpose

**Important Dates**
- Start date
- End date
- Renewal date
- Notice period
- Notice deadline
- Auto-renewal

**Commercial Terms**
- Contract value
- Currency
- Payment terms
- Payment frequency
- Pricing
- Price escalation
- Minimum commitments
- Late-payment terms

**Key Clauses**
- Termination
- Early termination
- Liability
- Liability cap
- Governing law
- Assignment
- Change of control
- NDA / confidentiality
- Data / compliance obligations
- SLA commitments

**Things to Watch**
- Title
- Severity
- Explanation

---

## Extraction Rules

1. Never invent information that is not present in the contract.
2. If information cannot be found, explicitly return: `"Not found"`.
3. Preserve dates accurately.
4. Preserve monetary values and currencies accurately.
5. Distinguish between explicit contract terms and AI interpretation.
6. Identify the relevant contract section when possible.
7. Do not provide definitive legal advice.
8. "Things to Watch" should identify provisions requiring attention or review rather than automatically declaring that something is legally invalid, unlawful, or legally dangerous.
9. Do not infer a contract term simply because it is common in similar contracts.
10. If multiple clauses affect the same field, identify the relevant clauses and avoid silently choosing one without acknowledging the conflict.

---

## Missing Information Handling

The AI must **NOT** guess missing information.

Example — correct:
```
Liability Cap: Not found
```

Example — incorrect (never do this):
```
Liability Cap: $100,000   <- invented, not in contract
```

This rule applies to every field: dates, renewal information, payment terms, pricing, liability, SLAs, governing law, termination conditions, and any other extracted field.

---

## MVP Priority Fields

Highest priority for initial implementation:

1. Parties
2. Contract type
3. Start date
4. End date
5. Renewal date
6. Notice period
7. Auto-renewal
8. Payment terms
9. Price escalation
10. Termination
11. Liability cap
12. Governing law
13. Things to Watch

All remaining fields are still part of the overall specification but are treated as secondary extraction fields for the initial implementation.
