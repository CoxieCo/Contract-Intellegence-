"use client";

import { useState } from "react";
import { IconChevronDown, IconTarget } from "./icons";

interface CoverageSample {
  l: string;
  v: string;
  c: string;
}

interface CoverageItem {
  title: string;
  badge: string;
  body: string;
  samples: CoverageSample[];
}

const COVERAGE: CoverageItem[] = [
  {
    title: "Renewal & Expiry",
    badge: "DATE FIELDS",
    body: "Identifies start dates, expiry dates, renewal dates, renewal frequency and the deadlines that follow from them. Values are preserved exactly as written — a renewal term expressed as a full sentence stays a full sentence.",
    samples: [
      { l: "Renewal term", v: "Two (2) years commencing on expiry of the Initial Term", c: "Item 13, Special Condition 1,4" },
      { l: "Notice required", v: "120 days", c: "Section 12.2" },
    ],
  },
  {
    title: "Notice Periods",
    badge: "DATE FIELDS",
    body: "Finds the notice period and the notice deadline it implies, so the window to act is explicit rather than buried mid-clause.",
    samples: [{ l: "Notice period", v: "Not less than three (3) months prior to expiry of the then-current term", c: "Special Condition 4.2" }],
  },
  {
    title: "Auto-Renewal",
    badge: "CLAUSE",
    body: "Detects evergreen and auto-renewal language, including conditional renewals that only trigger when notice is not given in time.",
    samples: [{ l: "Auto-renewal", v: "Yes — renews automatically unless notice is given", c: "Page 2" }],
  },
  {
    title: "Payment Terms",
    badge: "COMMERCIAL",
    body: "Extracts payment terms, frequency, pricing and escalation — including CPI-linked or percentage increases that compound over the term.",
    samples: [
      { l: "Price escalation", v: "8% annually from year two", c: "§4.3 · Page 6" },
      { l: "Payment terms", v: "Net 30", c: "§7.1" },
    ],
  },
  {
    title: "Termination Conditions",
    badge: "CLAUSE",
    body: "Surfaces termination and early-termination rights, the notice each requires, and any fees owed on exit.",
    samples: [{ l: "Early termination", v: "60 days’ written notice plus remaining minimum-commitment fees", c: "Section 11.2" }],
  },
  {
    title: "SLA Commitments",
    badge: "CLAUSE",
    body: "Identifies service-level commitments, uptime targets and the remedies attached to missing them.",
    samples: [{ l: "SLA", v: "99.9% uptime commitment", c: "Schedule 2" }],
  },
  {
    title: "Liability Caps",
    badge: "CLAUSE",
    body: "Finds liability provisions and caps. If no cap exists in the document, the field says “Not found” — never a guess.",
    samples: [{ l: "Liability cap", v: "$250,000", c: "Page 31" }],
  },
  {
    title: "Governing Law",
    badge: "CLAUSE",
    body: "Extracts the governing law and jurisdiction the agreement is subject to.",
    samples: [{ l: "Governing law", v: "Queensland, Australia", c: "§22.1" }],
  },
  {
    title: "Data & Compliance",
    badge: "CLAUSE",
    body: "Surfaces confidentiality, data-handling and compliance obligations, including those that survive termination.",
    samples: [{ l: "Confidentiality", v: "Survives for three (3) years after termination", c: "§16" }],
  },
  {
    title: "Assignment & Change of Control",
    badge: "CLAUSE",
    body: "Identifies assignment restrictions and change-of-control triggers that could affect a sale, merger or restructure.",
    samples: [{ l: "Assignment", v: "Consent required, not to be unreasonably withheld", c: "§19" }],
  },
];

export default function CoverageAccordion() {
  const [openIndex, setOpenIndex] = useState<number>(0);

  return (
    <div style={{ borderTop: "1px solid var(--color-divider)" }}>
      {COVERAGE.map((item, i) => {
        const open = openIndex === i;
        return (
          <div key={item.title} style={{ borderBottom: "1px solid var(--color-divider)" }}>
            <button
              type="button"
              onClick={() => setOpenIndex(open ? -1 : i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                width: "100%",
                background: open ? "color-mix(in srgb, var(--color-accent) 6%, transparent)" : "transparent",
                border: "none",
                padding: "16px 12px",
                cursor: "pointer",
                fontFamily: "inherit",
                color: "inherit",
                textAlign: "left",
                minHeight: 44,
                transition: "background 200ms cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1", flex: "none" }}>
                {String(i + 1).padStart(3, "0")}
              </span>
              <IconTarget />
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18, letterSpacing: "0.02em", textTransform: "uppercase", minWidth: 0, flex: 1 }}>
                {item.title}
              </span>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: "0.06em",
                  fontWeight: 600,
                  border: "1px solid var(--color-divider)",
                  padding: "2px 8px",
                  color: "color-mix(in srgb, var(--color-text) 60%, transparent)",
                  flex: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {item.badge}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, letterSpacing: "0.06em", fontWeight: 600, color: "var(--color-accent-700)", flex: "none" }}>
                <span style={{ width: 5, height: 5, background: "var(--color-accent)", flex: "none" }} />
                COVERED
              </span>
              <IconChevronDown rotated={open} />
            </button>
            <div className={`ci-accordion-panel ${open ? "is-open" : ""}`}>
              <div>
                <div style={{ padding: "2px 12px 20px 12px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 20 }}>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: "22px", maxWidth: "52ch", color: "color-mix(in srgb, var(--color-text) 78%, transparent)" }}>
                    {item.body}
                  </p>
                  <div style={{ border: "1px solid var(--color-divider)", padding: "12px 16px", alignSelf: "start" }}>
                    {item.samples.map((s) => (
                      <div key={s.l} style={{ padding: "7px 0", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 7%, transparent)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 2 }}>
                          <span style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                            {s.l}
                          </span>
                          <span style={{ fontSize: 10, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>{s.c}</span>
                        </div>
                        <span style={{ fontSize: 13, lineHeight: "19px", fontWeight: 600, overflowWrap: "break-word" }}>{s.v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
