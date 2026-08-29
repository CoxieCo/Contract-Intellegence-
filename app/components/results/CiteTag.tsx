"use client";

// Citation tag — label formatting, a "coming soon" tooltip when no page is
// known yet, click to open the PDF viewer — styled for the results view's
// light blueprint theme.

import { useEffect, useState } from "react";
import { IconCiteGlyph } from "./icons";

function formatSectionLabel(section: string): string {
  return section.replace(/^section\s+/i, "§");
}

export default function CiteTag({
  page,
  section,
  quote,
  onOpen,
  maxWidth = 150,
}: {
  page: number | null;
  section: string | null;
  // The exact clause text this citation points to, when the caller has it —
  // passed straight through to onOpen so PdfViewer can highlight it, not
  // just jump to the page. Every call site that has a genuinely verbatim
  // source value should pass it; sites without one (or that predate this)
  // can omit it, and the citation still works exactly as before, minus the
  // highlight.
  quote?: string | null;
  onOpen?: (page: number, section: string | null, quote: string | null) => void;
  maxWidth?: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (!showTooltip) return;
    const timeout = setTimeout(() => setShowTooltip(false), 2500);
    return () => clearTimeout(timeout);
  }, [showTooltip]);

  const hasPage = page != null;
  const sectionLabel = section ? formatSectionLabel(section) : null;
  const label = [hasPage ? `Page ${page}` : null, sectionLabel].filter(Boolean).join(" · ") || "Cite source";

  return (
    <span style={{ position: "relative", display: "inline-flex", minWidth: 0, maxWidth: "100%" }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (hasPage && onOpen) onOpen(page as number, section ?? null, quote ?? null);
          else setShowTooltip((s) => !s);
        }}
        className="tag tag-outline"
        style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0, maxWidth, cursor: "pointer", font: "inherit", background: "transparent" }}
      >
        <IconCiteGlyph />
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      </button>
      {showTooltip && !hasPage && (
        <span
          role="status"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            zIndex: 10,
            width: "max-content",
            maxWidth: 220,
            border: "1px solid var(--color-divider)",
            background: "var(--color-bg)",
            padding: "6px 10px",
            fontSize: 11,
            lineHeight: "16px",
            color: "color-mix(in srgb, var(--color-text) 70%, transparent)",
            boxShadow: "0 4px 14px rgba(0,0,0,.12)",
          }}
        >
          Source citation coming soon
        </span>
      )}
    </span>
  );
}
