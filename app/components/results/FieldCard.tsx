"use client";

import { ReactNode, useState } from "react";
import type { SourcedValue } from "@/lib/contract-analysis";
import CiteTag from "./CiteTag";

const PREVIEW_LEN = 100;

function truncateAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const lastSpace = clipped.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd();
}

export default function FieldCard({
  label,
  field,
  extraTag,
  highlighted,
  forwardedRef,
  onOpenCitation,
}: {
  label: string;
  field: SourcedValue;
  extraTag?: ReactNode;
  highlighted?: boolean;
  forwardedRef?: (el: HTMLDivElement | null) => void;
  onOpenCitation?: (page: number, section: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const notFound = field.value === "Not found";
  const hasCitation = field.page != null || field.section != null;

  // Prefer the model's generated summary as the collapsed view (exact clause
  // text stays available via expand, for verification/citation). Older
  // stored analyses predate the "summary" field, so they fall back to the
  // previous truncate-the-exact-text behavior instead.
  const summary = field.summary?.trim();
  const hasSummary = !notFound && !!summary && summary !== field.value;
  const isLongLegacy = !notFound && !hasSummary && field.value.length > PREVIEW_LEN;
  const showToggle = hasSummary || isLongLegacy;
  const collapsedText = hasSummary ? summary : isLongLegacy ? `${truncateAtWord(field.value, PREVIEW_LEN)}…` : field.value;
  const display = showToggle && !expanded ? collapsedText : field.value;

  return (
    <div
      ref={forwardedRef}
      className="card blueprint"
      style={{
        padding: "14px 16px",
        transition: "background 300ms ease",
        ...(highlighted ? { background: "var(--color-accent-100)", outline: "1px solid var(--color-accent)" } : {}),
      }}
    >
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 6 }}>
        <p className="card-kicker">{label}</p>
        {(extraTag || hasCitation) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {extraTag}
            {hasCitation && <CiteTag page={field.page} section={field.section} onOpen={onOpenCitation} />}
          </div>
        )}
      </div>
      <p
        style={{
          marginTop: 6,
          ...(notFound
            ? { fontStyle: "italic", color: "color-mix(in srgb, var(--color-text) 55%, transparent)", fontSize: 14 }
            : { fontWeight: 600, fontSize: 15.5, color: "var(--color-text)", lineHeight: 1.4 }),
        }}
      >
        {display}
      </p>
      {showToggle && (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 2, padding: 0, fontSize: 12, height: "auto", minHeight: 0 }}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Show summary" : hasSummary ? "View exact text" : "Read more"}
        </button>
      )}
    </div>
  );
}
