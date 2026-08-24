"use client";

import { useState } from "react";
import { IconChevronDown } from "./icons";

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: FaqItem[] = [
  {
    q: "What types of contracts can I upload?",
    a: "Any contract in PDF form — service agreements, leases, supply and vendor contracts, customer agreements. Long documents are read page by page.",
  },
  {
    q: "How does the AI analyse the PDF?",
    a: "Every page is read against a fixed extraction schema: overview, important dates, commercial terms, key clauses and things to watch. If something isn’t in the document, the field returns “Not found” rather than a guess.",
  },
  {
    q: "Can I ask questions about my contract?",
    a: "Yes. Ask in plain English and the answer is grounded in the uploaded document, with a reference to the section it came from.",
  },
  {
    q: "What information does the scanner extract?",
    a: "Parties, contract type and status, start and end dates, renewal and notice information, payment terms and escalation, termination conditions, liability and caps, governing law, SLA commitments — plus flagged items that need attention.",
  },
  {
    q: "Can it find renewal and notice periods?",
    a: "That’s the core of it. The scanner surfaces the renewal date, notice period, notice deadline and auto-renewal status so deadlines don’t pass unnoticed.",
  },
  {
    q: "Can it identify auto-renewal clauses?",
    a: "Yes, including conditional ones — renewals that only trigger when notice isn’t given in time are detected and flagged as things to watch.",
  },
  {
    q: "How does the system handle large contracts?",
    a: "A 45-page contract analyses in seconds. Long, compound values — a renewal term written as a full sentence, a citation spanning several items — are preserved verbatim, not shortened to fit a box.",
  },
  {
    q: "Can I see where an answer came from in the PDF?",
    a: "Every extracted field and answer carries a citation — page and section — that opens the PDF at that exact location.",
  },
  {
    q: "Is my contract data private?",
    a: "Documents are used only to produce your analysis. Access to results is scoped to your session, and processing is rate-limited per user.",
  },
  {
    q: "Who is the platform designed for?",
    a: "Operations, procurement, legal operations and any team that manages vendor or customer agreements — anyone who’d otherwise read 80 pages to find one date.",
  },
];

function FaqColumn({
  items,
  offset,
  openIndex,
  onToggle,
}: {
  items: FaqItem[];
  offset: number;
  openIndex: number;
  onToggle: (i: number) => void;
}) {
  return (
    <div style={{ borderTop: "1px solid var(--color-divider)" }}>
      {items.map((item, j) => {
        const i = j + offset;
        const open = openIndex === i;
        return (
          <div key={item.q} style={{ borderBottom: "1px solid var(--color-divider)" }}>
            <button
              type="button"
              onClick={() => onToggle(open ? -1 : i)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                width: "100%",
                background: open ? "color-mix(in srgb, var(--color-accent) 6%, transparent)" : "transparent",
                border: "none",
                padding: "16px 10px",
                cursor: "pointer",
                fontFamily: "inherit",
                color: "inherit",
                textAlign: "left",
                minHeight: 44,
                transition: "background 200ms cubic-bezier(0.4,0,0.2,1)",
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 600, minWidth: 0 }}>{item.q}</span>
              <IconChevronDown rotated={open} />
            </button>
            <div className={`ci-accordion-panel ${open ? "is-open" : ""}`}>
              <div>
                <p style={{ margin: 0, padding: "0 10px 18px", fontSize: 14, lineHeight: "23px", color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number>(-1);
  const left = FAQ.slice(0, 5);
  const right = FAQ.slice(5);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))", gap: "0 clamp(28px,4vw,64px)", alignItems: "start" }}>
      <FaqColumn items={left} offset={0} openIndex={openIndex} onToggle={setOpenIndex} />
      <FaqColumn items={right} offset={5} openIndex={openIndex} onToggle={setOpenIndex} />
    </div>
  );
}
