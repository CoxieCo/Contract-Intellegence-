"use client";

// Results view for Subcontract mode (see lib/subcontract-analysis.ts) — the
// same nav, file card, sidebar, collapsible sections, field cards, citations
// and "Unknown Fields" consolidation as ResultsView, laid out over the
// subcontract categories instead of the general-contract ones. Every card's
// citation highlights the field's verbatim `quote` in the PDF (FieldCard
// prefers `quote` over `value` for its exact text).
//
// Nothing here calculates or adds anything: what's shown is what
// enforceContractOnly() kept from the contract's own words, under a
// permanent banner saying so.

import { forwardRef, ReactNode, useImperativeHandle, useRef, useState } from "react";
import type { SourcedValue } from "@/lib/contract-analysis";
import {
  SUBCONTRACT_DISCLAIMER,
  SUBCONTRACT_SECTIONS,
  isFieldFound,
  type InsuranceRequirement,
  type NoticeDeadline,
  type SubcontractAnalysis,
  type SubcontractField,
  type SubcontractSectionId,
} from "@/lib/subcontract-analysis";
import "./results.css";
import Sidebar, { type SidebarItem } from "./Sidebar";
import FieldCard from "./FieldCard";
import { FileInfoCard, GlanceCard, MissingFieldCard, ResultsNav, SectionHeader, SectionPanel } from "./ResultsView";
import { IconAlertTriangle, IconCalendar, IconFile, IconFileCheck, IconHelpCircle, IconList } from "./icons";

export type SubcontractViewSectionId = SubcontractSectionId | "unknown";

export interface SubcontractResultsViewHandle {
  jumpTo: (section: SubcontractViewSectionId, opts?: { fieldKey?: string }) => void;
}

interface SubcontractResultsViewProps {
  analysis: SubcontractAnalysis;
  fileName: string;
  analyzedAt: Date | null;
  onOpenCitation: (page: number, section: string | null, quote: string | null) => void;
  onExportPdf: () => void;
  onAskContract: () => void;
}

function sectionIcon(id: SubcontractSectionId, size: number): ReactNode {
  if (id === "parties") return <IconFile size={size} />;
  if (id === "defectsLiability") return <IconCalendar size={size} />;
  if (id === "timeBars") return <IconAlertTriangle size={size} />;
  if (id === "insuranceAndLicences" || id === "termination" || id === "disputes") return <IconFileCheck size={size} />;
  return <IconList size={size} />;
}

const SIDEBAR_ITEMS: SidebarItem<SubcontractViewSectionId>[] = [
  ...SUBCONTRACT_SECTIONS.map((s) => ({ id: s.id as SubcontractViewSectionId, label: s.title, icon: sectionIcon(s.id, 16) })),
  { id: "unknown", label: "Unknown Fields", icon: <IconHelpCircle size={16} /> },
];

// The three terms a subcontractor most needs at a glance — shown only when
// actually found, like ResultsView's own At a glance row.
const GLANCE: { section: SubcontractSectionId; key: string; label: string }[] = [
  { section: "paymentTerms", key: "paymentPeriodAsWritten", label: "Payment period" },
  { section: "retention", key: "retentionPercent", label: "Retention" },
  { section: "timeBars", key: "variationNoticeDeadline", label: "Variation notice" },
];

interface CardEntry {
  key: string;
  label: string;
  field: SourcedValue;
  // false when enforceContractOnly() couldn't find the quote in the PDF's
  // extracted text — shown, but flagged rather than presented as checked.
  quoteVerified?: boolean;
}

// An analysis restored from the dashboard isn't re-run through
// enforceContractOnly(), so coerce the props FieldCard/GlanceCard call
// string methods on — a malformed field then renders as text or Not found
// instead of crashing the page.
function normalizeField<T extends SubcontractField>(f: T): T {
  return {
    ...f,
    value: typeof f.value === "string" ? f.value : "",
    summary: typeof f.summary === "string" ? f.summary : undefined,
    quote: typeof f.quote === "string" ? f.quote : "",
    page: typeof f.page === "number" ? f.page : null,
    section: typeof f.section === "string" ? f.section : null,
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function fieldOf(analysis: SubcontractAnalysis, section: SubcontractSectionId, key: string): SubcontractField | undefined {
  const sec = (analysis as unknown as Record<string, unknown>)[section];
  const f = isObject(sec) ? sec[key] : undefined;
  return isObject(f) ? normalizeField(f as unknown as SubcontractField) : undefined;
}

function listOf(analysis: SubcontractAnalysis, section: SubcontractSectionId, key: string): (InsuranceRequirement | NoticeDeadline)[] {
  const sec = (analysis as unknown as Record<string, unknown>)[section];
  const items = isObject(sec) ? sec[key] : undefined;
  return Array.isArray(items)
    ? items.filter(isObject).map((item) => normalizeField(item as unknown as InsuranceRequirement | NoticeDeadline))
    : [];
}

function listItemLabel(item: InsuranceRequirement | NoticeDeadline): string {
  if ("type" in item && typeof item.type === "string" && item.type) return item.type;
  if ("label" in item && typeof item.label === "string" && item.label) return item.label;
  return "Item";
}

export function SubcontractBanner() {
  return (
    <div className="card blueprint" role="note" style={{ padding: "14px 18px", borderColor: "var(--color-warning-border)", background: "var(--color-warning-bg)" }}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      <p style={{ margin: 0, display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, lineHeight: 1.5, fontWeight: 600, color: "var(--color-warning-text)" }}>
        <span style={{ flex: "none", marginTop: 1 }}>
          <IconAlertTriangle size={17} />
        </span>
        {SUBCONTRACT_DISCLAIMER}
      </p>
    </div>
  );
}

const SubcontractResultsView = forwardRef<SubcontractResultsViewHandle, SubcontractResultsViewProps>(function SubcontractResultsView(
  { analysis, fileName, analyzedAt, onOpenCitation, onExportPdf, onAskContract },
  ref
) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Partial<Record<SubcontractViewSectionId, boolean>>>({});
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const refs = useRef<Map<string, HTMLElement>>(new Map());
  const highlightTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const registerRef = (key: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(key, el);
    else refs.current.delete(key);
  };

  const toggleSection = (id: SubcontractViewSectionId) => setOpenSections((s) => ({ ...s, [id]: !s[id] }));

  // Same behavior as ResultsView's jumpTo: open the section, scroll to it
  // (or to one field in it), flash a highlight.
  const jumpTo: SubcontractResultsViewHandle["jumpTo"] = (section, opts) => {
    setOpenSections((s) => ({ ...s, [section]: true }));
    const key = opts?.fieldKey ? `${section}.${opts.fieldKey}` : `section.${section}`;
    clearTimeout(highlightTimeout.current);
    setTimeout(() => {
      const el = refs.current.get(key) ?? refs.current.get(`section.${section}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightKey(key);
      highlightTimeout.current = setTimeout(() => setHighlightKey(null), 1800);
    }, 60);
  };

  useImperativeHandle(ref, () => ({ jumpTo }));

  // Each section's found cards (scalar fields, then one card per list item),
  // with every "Not found" field — and any list the contract states nothing
  // for — consolidated into Unknown Fields, same as ResultsView.
  const allMissing: { key: string; label: string; category: string }[] = [];
  const sections = SUBCONTRACT_SECTIONS.map((meta) => {
    const found: CardEntry[] = [];
    for (const [key, label] of Object.entries(meta.fields)) {
      const field = fieldOf(analysis, meta.id, key);
      if (field && isFieldFound(field)) found.push({ key, label, field, quoteVerified: field.quoteVerified });
      else allMissing.push({ key: `${meta.id}.${key}`, label, category: meta.title });
    }
    if (meta.list) {
      const items = listOf(analysis, meta.id, meta.list.key).filter(isFieldFound);
      if (items.length === 0) allMissing.push({ key: `${meta.id}.${meta.list.key}`, label: meta.list.label, category: meta.title });
      items.forEach((item, i) => {
        const field: SourcedValue =
          "amount" in item && typeof item.amount === "string" && item.amount
            ? { ...item, value: item.amount, summary: item.amount === "Not stated" ? "Amount not stated" : item.amount }
            : item;
        found.push({ key: `${meta.list!.key}.${i}`, label: listItemLabel(item), field, quoteVerified: item.quoteVerified });
      });
    }
    return {
      meta,
      found: found.map((f) => ({ ...f, refCb: registerRef(`${meta.id}.${f.key}`) as (el: HTMLDivElement | null) => void })),
    };
  });

  const glanceCandidates = GLANCE.map((g) => ({ label: g.label, field: fieldOf(analysis, g.section, g.key) })).filter(
    (c): c is { label: string; field: SubcontractField } => !!c.field && isFieldFound(c.field)
  );

  const sectionRefs = SIDEBAR_ITEMS.reduce(
    (acc, item) => {
      acc[item.id] = registerRef(`section.${item.id}`) as (el: HTMLButtonElement | null) => void;
      return acc;
    },
    {} as Record<SubcontractViewSectionId, (el: HTMLButtonElement | null) => void>
  );

  return (
    <div className="ci-results" style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", display: "flex", flexDirection: "column" }}>
      <ResultsNav />

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar<SubcontractViewSectionId>
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
          onJump={(section) => jumpTo(section)}
          items={SIDEBAR_ITEMS}
        />

        <main style={{ flex: 1, minWidth: 0, padding: "32px 40px 90px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 900, display: "flex", flexDirection: "column", gap: 22 }}>
            <FileInfoCard fileName={fileName} analyzedAt={analyzedAt} onExportPdf={onExportPdf} onAskContract={onAskContract} />

            <SubcontractBanner />

            {glanceCandidates.length > 0 && (
              <div>
                <p style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-accent)", margin: "0 0 12px" }}>
                  At a glance
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>
                  {glanceCandidates.map((c) => (
                    <GlanceCard key={c.label} label={c.label} field={c.field} onOpenCitation={onOpenCitation} />
                  ))}
                </div>
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--color-divider)", marginTop: 4 }} />

            {sections.map(({ meta, found }) => (
              <section key={meta.id}>
                <SectionHeader
                  icon={sectionIcon(meta.id, 17)}
                  title={meta.title}
                  count={`${found.length} field${found.length !== 1 ? "s" : ""}`}
                  open={!!openSections[meta.id]}
                  onToggle={() => toggleSection(meta.id)}
                  forwardedRef={sectionRefs[meta.id]}
                />
                <SectionPanel open={!!openSections[meta.id]}>
                  {found.length === 0 && <p className="text-muted" style={{ fontSize: 13.5 }}>Nothing in this section was found in the contract — see Unknown Fields.</p>}
                  {found.map((f) => (
                    <FieldCard
                      key={f.key}
                      label={f.label}
                      field={f.field}
                      extraTag={
                        f.quoteVerified === false ? (
                          <span className="tag tag-neutral" title="This quote could not be matched to the text extracted from the PDF. Check the source page before relying on it.">
                            Quote not matched to PDF
                          </span>
                        ) : undefined
                      }
                      highlighted={highlightKey === `${meta.id}.${f.key}`}
                      forwardedRef={f.refCb}
                      onOpenCitation={onOpenCitation}
                    />
                  ))}
                </SectionPanel>
              </section>
            ))}

            <section>
              <SectionHeader
                icon={<IconHelpCircle size={17} />}
                title="Unknown Fields"
                count={`${allMissing.length} field${allMissing.length !== 1 ? "s" : ""}`}
                open={!!openSections.unknown}
                onToggle={() => toggleSection("unknown")}
                forwardedRef={sectionRefs.unknown}
              />
              <SectionPanel open={!!openSections.unknown}>
                {allMissing.length === 0 && (
                  <p className="text-muted" style={{ fontSize: 13.5 }}>Nothing missing — every field in the schema was found in this document.</p>
                )}
                {allMissing.map((f) => (
                  <MissingFieldCard key={f.key} label={f.label} category={f.category} />
                ))}
              </SectionPanel>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
});

export default SubcontractResultsView;
