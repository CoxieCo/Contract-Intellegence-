"use client";

import { useEffect, useState } from "react";
import type { ThingToWatch } from "@/lib/contract-analysis";
import CiteTag from "./CiteTag";
import { IconChevronDown } from "./icons";

const SEVERITY_TAG_CLASS: Record<ThingToWatch["severity"], string> = {
  HIGH: "tag tag-outline",
  MEDIUM: "tag tag-accent",
  LOW: "tag tag-neutral",
};

const SEVERITY_DOT: Record<ThingToWatch["severity"], string> = {
  HIGH: "var(--color-accent-800)",
  MEDIUM: "var(--color-accent-500)",
  LOW: "var(--color-neutral-500)",
};

const SEVERITY_BORDER: Record<ThingToWatch["severity"], string> = {
  HIGH: "var(--color-accent-700)",
  MEDIUM: "var(--color-divider)",
  LOW: "var(--color-divider)",
};

// Collapsed by default (title + severity only) — same accordion pattern as
// the dashboard's cross-contract rollup, so a Things to Watch section on a
// dense real contract doesn't render as a stack of full paragraphs.
export default function WatchCard({
  item,
  highlighted,
  forwardedRef,
  onOpenCitation,
}: {
  item: ThingToWatch;
  highlighted?: boolean;
  forwardedRef?: (el: HTMLDivElement | null) => void;
  onOpenCitation?: (page: number, section: string | null, quote: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasCitation = item.page != null || item.section != null;

  // A citation jump (via jumpTo in ResultsView) scrolls to this card even
  // when collapsed — auto-expand so the highlight actually reveals content.
  useEffect(() => {
    if (highlighted) setOpen(true);
  }, [highlighted]);

  return (
    <div
      ref={forwardedRef}
      className="card blueprint"
      style={{
        padding: 0,
        transition: "background 300ms ease",
        borderColor: SEVERITY_BORDER[item.severity],
        ...(highlighted ? { background: "var(--color-accent-100)", outline: "1px solid var(--color-accent)" } : {}),
      }}
    >
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "15px 16px" }}
      >
        <span className={SEVERITY_TAG_CLASS[item.severity]} style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: SEVERITY_DOT[item.severity] }} />
          {item.severity}
        </span>
        <span style={{ fontWeight: 600, fontSize: 15, flex: 1, minWidth: 0, textAlign: "left" }}>{item.title}</span>
        <IconChevronDown rotated={open} />
      </button>

      <div className={`ci-accordion-panel ${open ? "is-open" : ""}`}>
        <div>
          <div style={{ padding: "0 16px 15px" }}>
            <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.55, margin: 0 }}>
              {item.explanation}
            </p>
            {hasCitation && (
              <div style={{ marginTop: 10 }}>
                <CiteTag page={item.page} section={item.section} quote={item.quote} onOpen={onOpenCitation} maxWidth={150} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
