"use client";

import type { ThingToWatch } from "@/lib/contract-analysis";
import CiteTag from "./CiteTag";

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

export default function WatchCard({
  item,
  highlighted,
  forwardedRef,
  onOpenCitation,
}: {
  item: ThingToWatch;
  highlighted?: boolean;
  forwardedRef?: (el: HTMLDivElement | null) => void;
  onOpenCitation?: (page: number, section: string | null) => void;
}) {
  const hasCitation = item.page != null || item.section != null;

  return (
    <div
      ref={forwardedRef}
      className="card blueprint"
      style={{
        padding: "15px 16px",
        transition: "background 300ms ease",
        borderColor: SEVERITY_BORDER[item.severity],
        ...(highlighted ? { background: "var(--color-accent-100)", outline: "1px solid var(--color-accent)" } : {}),
      }}
    >
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className={SEVERITY_TAG_CLASS[item.severity]} style={{ display: "inline-flex", alignItems: "center", gap: 6, flex: "none" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: SEVERITY_DOT[item.severity] }} />
          {item.severity}
        </span>
        {hasCitation && (
          <span style={{ marginLeft: "auto" }}>
            <CiteTag page={item.page} section={item.section} onOpen={onOpenCitation} maxWidth={150} />
          </span>
        )}
      </div>
      <p style={{ fontWeight: 600, fontSize: 15, margin: "8px 0 0" }}>{item.title}</p>
      <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "6px 0 0" }}>
        {item.explanation}
      </p>
    </div>
  );
}
