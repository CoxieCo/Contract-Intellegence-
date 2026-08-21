"use client";

// Homepage marketing section — two-column FAQ accordion. Reuses the same
// `.accordion-panel` height-transition (globals.css) and chevron-rotation
// convention as the Things to Watch accordion (app/page.tsx) rather than
// introducing a new expand/collapse mechanism.

import { useState } from "react";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const LEFT_ITEMS: FaqItem[] = [
  {
    id: "left-0",
    question: "Is my contract data private?",
    answer:
      "Yes. Contracts are processed only to run the extraction you see on screen. We don't sell contract data or use it to train models. You can remove a contract from your dashboard at any time.",
  },
  {
    id: "left-1",
    question: "What file types are supported?",
    answer: "PDF only right now, up to 15MB per file. Support for Word documents is on the roadmap.",
  },
  {
    id: "left-2",
    question: "How accurate is the extraction?",
    answer:
      "Accuracy depends on how the contract itself is drafted, but every extracted value comes with a citation back to its page and section, so you can verify it directly in the source PDF instead of taking our word for it.",
  },
];

const RIGHT_ITEMS: FaqItem[] = [
  {
    id: "right-0",
    question: "Can I cancel anytime?",
    answer: "Yes. All plans are month-to-month with no lock-in. Cancel from your account settings and you won't be billed again.",
  },
  {
    id: "right-1",
    question: "What happens if the AI can't find something in my contract?",
    answer:
      "The field is shown as \"Not found\" instead of a guess. We'd rather leave a gap than fabricate a date or clause that isn't actually there.",
  },
  {
    id: "right-2",
    question: "Is this a replacement for legal review?",
    answer:
      "No. Contract Intelligence surfaces what to review and where to look — it's not legal advice and doesn't replace a qualified reviewer. Use it to triage which contracts and clauses need a closer look.",
  },
];

// Same rotation transition as the Things to Watch chevron (ChevronIcon in
// app/page.tsx) — duration and transform are reused, not reinvented. The
// only addition is color: muted by default, foreground on hover, accent
// while the card is open — the section's one deliberate, sparing use of the
// accent color to mark the active item.
function FaqChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-200 ${
        open ? "rotate-180 text-accent" : "text-muted group-hover:text-foreground"
      }`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}

function FaqCard({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  return (
    <div
      className={`rounded-md border bg-surface transition-colors duration-300 ${
        open
          ? "border-accent/30 hover:border-accent/45 hover:bg-surface-raised"
          : "border-hairline hover:border-hairline-strong hover:bg-surface-raised"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group flex w-full cursor-pointer items-center gap-2.5 px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <FaqChevron open={open} />
        <span className="text-sm font-medium text-foreground">{item.question}</span>
      </button>
      <div className={`accordion-panel ${open ? "is-open" : ""}`}>
        <div>
          <p className="pb-4 pl-7 pr-4 text-sm leading-6 text-muted">{item.answer}</p>
        </div>
      </div>
    </div>
  );
}

export default function Faq() {
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(["left-0"]));

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section id="faq" className="border-t border-hairline bg-surface/40">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:py-[72px]">
        <div className="mb-10 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted">FAQ</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
            Frequently asked questions
          </h2>
        </div>

        {/* Each column stacks its own cards independently — keeps a shorter
            column from being stretched to match a taller one, so uneven
            answer lengths don't read as lopsided. */}
        <div className="grid gap-3 md:grid-cols-2 md:items-start md:gap-x-6">
          <div className="flex flex-col gap-3">
            {LEFT_ITEMS.map((item) => (
              <FaqCard key={item.id} item={item} open={openItems.has(item.id)} onToggle={() => toggleItem(item.id)} />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {RIGHT_ITEMS.map((item) => (
              <FaqCard key={item.id} item={item} open={openItems.has(item.id)} onToggle={() => toggleItem(item.id)} />
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center gap-1 rounded-md border border-hairline bg-surface px-6 py-8 text-center shadow-panel">
          <p className="text-sm font-semibold text-foreground">Couldn&apos;t find your answer?</p>
          <p className="text-sm text-muted">We&apos;re happy to help directly.</p>
          <a
            href="mailto:support@contractintelligence.com"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-raised px-4 py-2.5 text-sm font-medium text-foreground transition-colors duration-200 hover:border-hairline-strong hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <MailIcon />
            support@contractintelligence.com
          </a>
        </div>
      </div>
    </section>
  );
}
