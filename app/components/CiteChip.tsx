"use client";

import { useEffect, useState } from "react";

// Leading glyph shown on every citation chip.
function CiteIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-75">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

// Turns a model-extracted section reference like "Section 9.1-9.2" into the
// compact "§9.1-9.2" notation used on the chip — display-only, doesn't touch
// what the backend actually extracted.
function formatSectionLabel(section: string): string {
  return section.replace(/^section\s+/i, "§");
}

type CiteChipProps =
  | {
      actionable?: true;
      page?: number | null;
      section?: string | null;
      onOpen?: (page: number, section: string | null) => void;
      // Quick Scan's denser, single-line rows use the arrow as a stronger
      // "there's more here" affordance; Full Review's already-spacious
      // FieldCard/ClauseCard chips don't need it. Zone-level styling choice,
      // not tied to whether this particular field's location is known.
      arrow?: boolean;
      label?: undefined;
      className?: undefined;
    }
  | {
      actionable: false;
      label: string;
      page?: undefined;
      section?: undefined;
      onOpen?: undefined;
      arrow?: undefined;
      className?: string;
    };

// The single citation chip used everywhere a field, clause or watch item
// points back to the source PDF. Actionable chips (a real page/section from
// the analysis) open the PDF viewer, or — before a location is known —
// disclose a "coming soon" tooltip; same click affordance either way, so the
// chip's shape never promises more than it can do. Non-actionable chips
// (AI-answer source hints, the homepage demo) render as a plain caption: no
// border, no arrow, nothing to click.
export default function CiteChip(props: CiteChipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!showTooltip) return;
    const timeout = setTimeout(() => setShowTooltip(false), 2500);
    return () => clearTimeout(timeout);
  }, [showTooltip]);

  if (props.actionable === false) {
    return (
      <span
        className={`inline-flex w-fit max-w-[150px] items-center px-2 py-1 text-[11px] font-medium text-muted ${props.className ?? ""}`}
      >
        <span className="min-w-0 truncate">{props.label}</span>
      </span>
    );
  }

  const { page, section, onOpen, arrow = false } = props;
  const hasPage = page != null;
  const sectionLabel = section ? formatSectionLabel(section) : null;
  const label = [hasPage ? `Page ${page}` : null, sectionLabel].filter(Boolean).join(" · ") || "Cite source";

  return (
    // No shrink-0 here (unlike most chip/badge patterns elsewhere in the
    // app) — this one has to be able to shrink below its own max-width in a
    // narrow container (a 2-column mobile FieldCard grid, in particular),
    // or it overflows past its own card's edge instead of truncating.
    <span className="relative inline-flex min-w-0 max-w-full">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (hasPage && onOpen) onOpen(page as number, section ?? null);
          else setShowTooltip((s) => !s);
        }}
        className="inline-flex min-w-0 max-w-[150px] items-center gap-1 rounded border border-hairline bg-surface px-2 py-1 text-[11px] font-medium text-muted transition-colors duration-200 hover:border-accent/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <CiteIcon />
        {/* Real contracts can produce long compound citations (multiple item/
            clause numbers) — this is the same unbounded-nowrap-text failure
            mode as the old Important Dates timeline, so the label gets its
            own min-w-0/truncate box instead of forcing the whole chip wider
            than its max-width and overlapping whatever sits next to it. */}
        <span className="min-w-0 truncate">{label}</span>
        {arrow && hasPage && <span aria-hidden="true" className="shrink-0">→</span>}
      </button>
      {showTooltip && !hasPage && (
        <span
          role="status"
          className="animate-fade-in absolute right-0 top-[calc(100%+7px)] z-10 w-max max-w-[220px] rounded-md border border-hairline-strong bg-surface-raised px-2.5 py-1.5 text-[11px] leading-4 text-muted shadow-panel before:absolute before:-top-[5px] before:right-3 before:h-2 before:w-2 before:rotate-45 before:border-l before:border-t before:border-hairline-strong before:bg-surface-raised"
        >
          Source citation coming soon
        </span>
      )}
    </span>
  );
}
