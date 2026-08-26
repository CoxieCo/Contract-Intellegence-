"use client";

// The post-scan results view — sidebar navigation, an "at a glance" summary,
// a top banner for the highest-severity flag, and five collapsible sections
// (identity/dates/terms/clauses/things to watch) built from generic field
// cards. Same "Industry" light theme as app/components/landing, imported
// from the same Results.dc.html design and scoped under .ci-results so it
// never leaks into the dark app shell (dashboard, PDF viewer, Ask AI palette
// stay exactly as they are).

import Link from "next/link";
import { forwardRef, ReactNode, useImperativeHandle, useRef, useState } from "react";
import type {
  CommercialTerms,
  ContractAnalysis,
  ContractOverview,
  ImportantDates,
  KeyClauses,
  SourcedValue,
  ThingToWatch,
} from "@/lib/contract-analysis";
import "./results.css";
import Sidebar from "./Sidebar";
import FieldCard from "./FieldCard";
import WatchCard from "./WatchCard";
import CiteTag from "./CiteTag";
import { IconAlertTriangle, IconCalendar, IconChevronDown, IconFile, IconFileCheck, IconList } from "./icons";

export type ResultSectionId = "overview" | "dates" | "terms" | "clauses" | "watch";

export interface ResultsViewHandle {
  jumpTo: (section: ResultSectionId, opts?: { fieldKey?: string; watchIndex?: number }) => void;
}

interface ResultsViewProps {
  analysis: ContractAnalysis;
  fileName: string;
  analyzedAt: Date | null;
  onOpenCitation: (page: number, section: string | null) => void;
  onExportJson: () => void;
  onExportPdf: () => void;
}

const overviewLabels: Record<keyof ContractOverview, string> = {
  contractName: "Contract name",
  contractType: "Contract type",
  parties: "Parties",
  status: "Status",
  purpose: "Purpose",
};

const datesLabels: Record<keyof ImportantDates, string> = {
  startDate: "Start date",
  endDate: "End date",
  renewalDate: "Renewal date",
  noticePeriod: "Notice period",
  noticeDeadline: "Notice deadline",
  autoRenewal: "Auto-renewal",
};

const termsLabels: Record<keyof CommercialTerms, string> = {
  contractValue: "Contract value",
  currency: "Currency",
  paymentTerms: "Payment terms",
  paymentFrequency: "Payment frequency",
  pricing: "Pricing",
  priceEscalation: "Price escalation",
  minimumCommitments: "Minimum commitments",
  latePaymentTerms: "Late-payment terms",
};

const clausesLabels: Record<keyof KeyClauses, string> = {
  termination: "Termination",
  earlyTermination: "Early termination",
  liability: "Liability",
  liabilityCap: "Liability cap",
  governingLaw: "Governing law",
  assignment: "Assignment",
  changeOfControl: "Change of control",
  ndaConfidentiality: "NDA / confidentiality",
  dataComplianceObligations: "Data / compliance obligations",
  slaCommitments: "SLA commitments",
};

// Purely cosmetic reframing of an already-extracted field — a small "Vendor
// contract" tag when the contractType classification reads as SaaS/software,
// for IT/vendor-management readers scanning a mixed batch of contracts.
const VENDOR_CONTRACT_TYPE_PATTERN = /saas|software|subscription|vendor/i;
function isVendorContractType(contractType: string): boolean {
  return VENDOR_CONTRACT_TYPE_PATTERN.test(contractType);
}

const MISSING_FIELD: SourcedValue = { value: "Not found", page: null, section: null };

// The model is asked to always include every field in the schema, but that's
// not guaranteed — a response that drops one key (as opposed to a whole
// section) used to crash every card here with "Cannot read properties of
// undefined (reading 'value')" the instant it tried to render. Falling back
// to the same "Not found" placeholder an intentionally-empty field already
// uses keeps a partial response renderable instead of taking down the page.
function fieldsFor<K extends string>(
  obj: Partial<Record<K, SourcedValue>> | undefined,
  labels: Record<K, string>
): { key: K; label: string; field: SourcedValue }[] {
  if (!obj) return [];
  return (Object.keys(labels) as K[]).map((key) => ({ key, label: labels[key], field: obj[key] ?? MISSING_FIELD }));
}

function formatAnalyzedAt(d: Date): string {
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return sameDay ? `Analyzed today at ${time}` : `Analyzed ${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${time}`;
}

function SectionHeader({
  icon,
  title,
  count,
  open,
  onToggle,
  forwardedRef,
}: {
  icon: ReactNode;
  title: string;
  count: string;
  open: boolean;
  onToggle: () => void;
  forwardedRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button type="button" className="section-toggle" onClick={onToggle} ref={forwardedRef}>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icon}
        <span className="section-title" style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 19 }}>
          {title}
        </span>
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="text-muted" style={{ fontSize: 12 }}>
          {count}
        </span>
        <IconChevronDown rotated={open} />
      </span>
    </button>
  );
}

function SectionPanel({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className={`ci-accordion-panel ${open ? "is-open" : ""}`}>
      <div>
        <div style={{ paddingTop: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

const ResultsView = forwardRef<ResultsViewHandle, ResultsViewProps>(function ResultsView(
  { analysis, fileName, analyzedAt, onOpenCitation, onExportJson, onExportPdf },
  ref
) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<ResultSectionId, boolean>>({
    overview: false,
    dates: false,
    terms: false,
    clauses: false,
    watch: false,
  });
  const [highlightKey, setHighlightKey] = useState<string | null>(null);

  const refs = useRef<Map<string, HTMLElement>>(new Map());
  const highlightTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const registerRef = (key: string) => (el: HTMLElement | null) => {
    if (el) refs.current.set(key, el);
    else refs.current.delete(key);
  };

  const toggleSection = (id: ResultSectionId) => setOpenSections((s) => ({ ...s, [id]: !s[id] }));

  const jumpTo: ResultsViewHandle["jumpTo"] = (section, opts) => {
    setOpenSections((s) => ({ ...s, [section]: true }));
    const key = opts?.watchIndex !== undefined ? `watch.${opts.watchIndex}` : opts?.fieldKey ? `${section}.${opts.fieldKey}` : `section.${section}`;
    clearTimeout(highlightTimeout.current);
    setTimeout(() => {
      const el = refs.current.get(key) ?? refs.current.get(`section.${section}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightKey(key);
      highlightTimeout.current = setTimeout(() => setHighlightKey(null), 1800);
    }, 60);
  };

  useImperativeHandle(ref, () => ({ jumpTo }));

  // Ref callbacks are precomputed here rather than called inline as JSX
  // attribute expressions below (same convention this app already uses for
  // ref-safety) — each one still only ever runs outside render, as a
  // genuine ref attach/detach, when React commits or unmounts the node.
  const identityFields = fieldsFor(analysis.contractOverview, overviewLabels).map((f) => ({
    ...f,
    refCb: registerRef(`overview.${f.key}`) as (el: HTMLDivElement | null) => void,
  }));
  const datesFields = fieldsFor(analysis.importantDates, datesLabels).map((f) => ({
    ...f,
    refCb: registerRef(`dates.${f.key}`) as (el: HTMLDivElement | null) => void,
  }));
  const termsFields = fieldsFor(analysis.commercialTerms, termsLabels).map((f) => ({
    ...f,
    refCb: registerRef(`terms.${f.key}`) as (el: HTMLDivElement | null) => void,
  }));
  const clausesFields = fieldsFor(analysis.keyClauses, clausesLabels).map((f) => ({
    ...f,
    refCb: registerRef(`clauses.${f.key}`) as (el: HTMLDivElement | null) => void,
  }));
  const watchItems = (analysis.thingsToWatch ?? []).map((w, i) => ({
    item: w,
    index: i,
    refCb: registerRef(`watch.${i}`) as (el: HTMLDivElement | null) => void,
  }));

  const sectionRefs = (["overview", "dates", "terms", "clauses", "watch"] as ResultSectionId[]).reduce(
    (acc, id) => {
      acc[id] = registerRef(`section.${id}`) as (el: HTMLButtonElement | null) => void;
      return acc;
    },
    {} as Record<ResultSectionId, (el: HTMLButtonElement | null) => void>
  );

  const topHighIndex = watchItems.findIndex((w) => w.item.severity === "HIGH");
  const topHighItem: ThingToWatch | null = topHighIndex >= 0 ? watchItems[topHighIndex].item : null;

  return (
    <div className="ci-results" style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", display: "flex", flexDirection: "column" }}>
      <nav className="nav" style={{ borderBottom: "1px solid var(--color-divider)", flex: "none", position: "sticky", top: 0, zIndex: 50, background: "var(--color-bg)" }}>
        <span className="nav-brand">Contract Intelligence</span>
        <Link href="/dashboard" className="btn btn-primary blueprint">
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
          Dashboard
        </Link>
      </nav>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
          onJump={(section, fieldKey) => jumpTo(section, fieldKey ? { fieldKey } : undefined)}
        />

        <main style={{ flex: 1, minWidth: 0, padding: "32px 40px 90px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 900, display: "flex", flexDirection: "column", gap: 22 }}>
            {/* File info + actions */}
            <div className="card blueprint" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", gap: "12px 16px" }}>
              <i className="corner tl" />
              <i className="corner tr" />
              <i className="corner bl" />
              <i className="corner br" />
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 300, flex: "1 1 300px" }}>
                <IconFile size={20} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fileName}</div>
                  {analyzedAt && (
                    <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
                      {formatAnalyzedAt(analyzedAt)}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 1 auto", flexWrap: "wrap" }}>
                <Link href="/dashboard" className="btn btn-primary blueprint">
                  <i className="corner tl" />
                  <i className="corner tr" />
                  <i className="corner bl" />
                  <i className="corner br" />
                  Dashboard
                </Link>
                <span className="tag tag-outline">Analyzed</span>
                <button type="button" className="btn btn-secondary" onClick={onExportPdf}>
                  Export PDF
                </button>
                <button type="button" className="btn btn-secondary" onClick={onExportJson}>
                  Export
                </button>
              </div>
            </div>

            {/* At a glance */}
            {(analysis.importantDates || analysis.keyClauses) && (
              <div>
                <p style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--color-accent)", margin: "0 0 12px" }}>
                  At a glance
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>
                  {analysis.importantDates && (
                    <GlanceCard label="Renewal date" field={analysis.importantDates.renewalDate ?? MISSING_FIELD} onOpenCitation={onOpenCitation} />
                  )}
                  {analysis.importantDates && (
                    <GlanceCard label="Notice period" field={analysis.importantDates.noticePeriod ?? MISSING_FIELD} onOpenCitation={onOpenCitation} />
                  )}
                  {analysis.keyClauses && (
                    <GlanceCard label="Liability cap" field={analysis.keyClauses.liabilityCap ?? MISSING_FIELD} onOpenCitation={onOpenCitation} />
                  )}
                </div>
              </div>
            )}

            {/* Top HIGH severity banner */}
            {topHighItem && (
              <div className="card blueprint" style={{ padding: "16px 18px", borderColor: "var(--color-accent-700)" }}>
                <i className="corner tl" />
                <i className="corner tr" />
                <i className="corner bl" />
                <i className="corner br" />
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span className="tag tag-outline" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-accent-800)" }} />
                      HIGH
                    </span>
                    <span style={{ fontWeight: 600 }}>{topHighItem.title}</span>
                  </div>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 12.5, padding: 0 }} onClick={() => jumpTo("watch")}>
                    View in full analysis →
                  </button>
                </div>
                <p className="text-muted" style={{ margin: "10px 0 0", fontSize: 13.5, lineHeight: 1.55 }}>
                  {topHighItem.explanation}
                </p>
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--color-divider)", marginTop: 4 }} />

            {/* Contract identity */}
            <section>
              <SectionHeader
                icon={<IconFile size={17} />}
                title="Contract identity"
                count="5 fields"
                open={openSections.overview}
                onToggle={() => toggleSection("overview")}
                forwardedRef={sectionRefs.overview}
              />
              <SectionPanel open={openSections.overview}>
                {identityFields.map((f) => (
                  <FieldCard
                    key={f.key}
                    label={f.label}
                    field={f.field}
                    extraTag={
                      f.key === "contractType" && f.field.value !== "Not found" && isVendorContractType(f.field.value) ? (
                        <span className="tag tag-accent">Vendor contract</span>
                      ) : undefined
                    }
                    highlighted={highlightKey === `overview.${f.key}`}
                    forwardedRef={f.refCb}
                    onOpenCitation={onOpenCitation}
                  />
                ))}
              </SectionPanel>
            </section>

            {/* Important dates */}
            <section>
              <SectionHeader
                icon={<IconCalendar size={17} />}
                title="Important dates"
                count="6 fields"
                open={openSections.dates}
                onToggle={() => toggleSection("dates")}
                forwardedRef={sectionRefs.dates}
              />
              <SectionPanel open={openSections.dates}>
                {datesFields.map((f) => (
                  <FieldCard
                    key={f.key}
                    label={f.label}
                    field={f.field}
                    highlighted={highlightKey === `dates.${f.key}`}
                    forwardedRef={f.refCb}
                    onOpenCitation={onOpenCitation}
                  />
                ))}
              </SectionPanel>
            </section>

            {/* Commercial terms */}
            <section>
              <SectionHeader
                icon={<IconList size={17} />}
                title="Commercial terms"
                count="8 fields"
                open={openSections.terms}
                onToggle={() => toggleSection("terms")}
                forwardedRef={sectionRefs.terms}
              />
              <SectionPanel open={openSections.terms}>
                {termsFields.map((f) => (
                  <FieldCard
                    key={f.key}
                    label={f.label}
                    field={f.field}
                    highlighted={highlightKey === `terms.${f.key}`}
                    forwardedRef={f.refCb}
                    onOpenCitation={onOpenCitation}
                  />
                ))}
              </SectionPanel>
            </section>

            {/* Key clauses */}
            <section>
              <SectionHeader
                icon={<IconFileCheck size={17} />}
                title="Key clauses"
                count="10 fields"
                open={openSections.clauses}
                onToggle={() => toggleSection("clauses")}
                forwardedRef={sectionRefs.clauses}
              />
              <SectionPanel open={openSections.clauses}>
                {clausesFields.map((f) => (
                  <FieldCard
                    key={f.key}
                    label={f.label}
                    field={f.field}
                    highlighted={highlightKey === `clauses.${f.key}`}
                    forwardedRef={f.refCb}
                    onOpenCitation={onOpenCitation}
                  />
                ))}
              </SectionPanel>
            </section>

            {/* Things to watch */}
            <section>
              <SectionHeader
                icon={<IconAlertTriangle size={17} />}
                title="Things to watch"
                count={`${watchItems.length} item${watchItems.length !== 1 ? "s" : ""}`}
                open={openSections.watch}
                onToggle={() => toggleSection("watch")}
                forwardedRef={sectionRefs.watch}
              />
              <div className={`ci-accordion-panel ${openSections.watch ? "is-open" : ""}`}>
                <div>
                  <div style={{ paddingTop: 6, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
                    {watchItems.length === 0 && <p className="text-muted" style={{ fontSize: 13.5 }}>No flagged items — nothing here needed a closer look.</p>}
                    {watchItems.map((w) => (
                      <WatchCard
                        key={w.index}
                        item={w.item}
                        highlighted={highlightKey === `watch.${w.index}`}
                        forwardedRef={w.refCb}
                        onOpenCitation={onOpenCitation}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
});

export default ResultsView;

function GlanceCard({
  label,
  field,
  onOpenCitation,
}: {
  label: string;
  field: SourcedValue;
  onOpenCitation: (page: number, section: string | null) => void;
}) {
  const notFound = field.value === "Not found";
  const hasCitation = field.page != null || field.section != null;
  // At a glance is meant to be a terse scan, not a wall of clause text — the
  // full exact text is always one click away in the dedicated section below.
  const summary = field.summary?.trim();
  const display = !notFound && summary ? summary : field.value;
  return (
    <div className="card blueprint" style={{ padding: "16px 18px" }}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      <p className="card-kicker" style={{ margin: "0 0 6px" }}>
        {label}
      </p>
      <p
        style={
          notFound
            ? { fontSize: 18, fontWeight: 600, fontStyle: "italic", color: "color-mix(in srgb, var(--color-text) 55%, transparent)", lineHeight: 1.3, margin: 0 }
            : { fontSize: 18, fontWeight: 600, lineHeight: 1.3, margin: "0 0 8px" }
        }
      >
        {display}
      </p>
      {!notFound && hasCitation && <CiteTag page={field.page} section={field.section} onOpen={onOpenCitation} />}
    </div>
  );
}
