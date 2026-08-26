import type {
  CommercialTerms,
  ContractAnalysis,
  ContractOverview,
  ImportantDates,
  KeyClauses,
  SourcedValue,
  ThingToWatch,
} from "@/lib/contract-analysis";
import { severityRank } from "@/lib/contract-analysis";

// Light, print-safe palette — deliberately independent of the app's dark
// --surface/--accent tokens (see globals.css), since those are fixed dark
// values with no light variant and would waste ink / look wrong on paper.
const SEVERITY_PRINT: Record<ThingToWatch["severity"], { card: string; badge: string }> = {
  HIGH: { card: "border-red-200 bg-red-50", badge: "border-red-300 bg-red-100 text-red-700" },
  MEDIUM: { card: "border-amber-200 bg-amber-50", badge: "border-amber-300 bg-amber-100 text-amber-800" },
  LOW: { card: "border-slate-200 bg-slate-50", badge: "border-slate-300 bg-slate-100 text-slate-600" },
};

function notFound(value: string | undefined | null): boolean {
  return !value || value === "Not found";
}

// Same field labels as the results view's own section headings (see
// app/components/results/ResultsView.tsx) — kept as a separate copy here
// rather than a shared import so this print document's field list can't
// silently drift out of sync without a visible diff in this file.
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

const MISSING_FIELD: SourcedValue = { value: "Not found", page: null, section: null };

function citationLabel(source: { page: number | null; section: string | null }): string | null {
  const parts = [source.page != null ? `p. ${source.page}` : null, source.section ?? null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function fieldsFor<K extends string>(obj: Partial<Record<K, SourcedValue>> | undefined, labels: Record<K, string>) {
  return (Object.keys(labels) as K[]).map((key) => ({ key, label: labels[key], field: obj?.[key] ?? MISSING_FIELD }));
}

// Always renders `field.value` — the exact, verbatim clause text — never
// `field.summary`. The summary paraphrase exists for the results view's
// collapsed/at-a-glance display, where the exact text stays one click away;
// a printed export has no "expand" affordance, so it always needs the full
// text up front.
function FieldRow({ label, field }: { label: string; field: SourcedValue }) {
  const missing = notFound(field.value);
  const citation = citationLabel(field);
  return (
    <div className="break-inside-avoid border-b border-neutral-100 pb-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-neutral-500">{label}</p>
        {citation && <p className="shrink-0 text-[10px] text-neutral-400">{citation}</p>}
      </div>
      <p className={`mt-0.5 text-sm leading-5 ${missing ? "italic text-neutral-400" : "font-medium text-neutral-900"}`}>{field.value}</p>
    </div>
  );
}

function FieldSection<K extends string>({
  title,
  obj,
  labels,
}: {
  title: string;
  obj: Partial<Record<K, SourcedValue>> | undefined;
  labels: Record<K, string>;
}) {
  const fields = fieldsFor(obj, labels);
  if (fields.length === 0) return null;
  return (
    <div className="mt-6 break-before-auto">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-3">
        {fields.map((f) => (
          <FieldRow key={f.key} label={f.label} field={f.field} />
        ))}
      </div>
    </div>
  );
}

// Rendered off-screen at all times (`hidden print:block`) rather than
// mounted on demand — @media print in globals.css does the actual work of
// hiding the rest of the app and pulling this element into view, so there's
// no visibility state to coordinate with the Export Analysis button's click.
export default function ContractSummaryPrint({
  analysis,
  fileName,
  analyzedAt,
}: {
  analysis: ContractAnalysis;
  fileName: string;
  analyzedAt: Date;
}) {
  const overview = analysis.contractOverview;
  const title = !notFound(overview?.contractName?.value) ? overview!.contractName.value : fileName;
  const subline = [
    !notFound(overview?.contractType?.value) ? overview!.contractType.value : null,
    !notFound(overview?.parties?.value) ? overview!.parties.value : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Every item, not a top-N slice — this document is meant to match Full
  // Analysis in its entirety, not condense it.
  const watchItems = [...(analysis.thingsToWatch ?? [])].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return (
    <div id="print-summary-root" className="hidden bg-white text-neutral-900 print:block">
      <div className="mx-auto max-w-3xl px-10 py-10">
        {/* Contract identity header */}
        <div className="border-b border-neutral-200 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Contract analysis</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
          {subline && <p className="mt-1 text-sm text-neutral-500">{subline}</p>}
          {!notFound(overview?.status?.value) && (
            <span className="mt-2 inline-flex items-center rounded border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-600">
              {overview!.status.value}
            </span>
          )}
        </div>

        <FieldSection title="Contract identity" obj={overview} labels={overviewLabels} />
        <FieldSection title="Important dates" obj={analysis.importantDates} labels={datesLabels} />
        <FieldSection title="Commercial terms" obj={analysis.commercialTerms} labels={termsLabels} />
        <FieldSection title="Key clauses" obj={analysis.keyClauses} labels={clausesLabels} />

        {/* Things to watch — every flagged item, full explanation text */}
        {watchItems.length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Things to watch</p>
            <div className="mt-2 space-y-2.5">
              {watchItems.map((item, i) => {
                const style = SEVERITY_PRINT[item.severity];
                const citation = citationLabel(item);
                return (
                  <div key={i} className={`break-inside-avoid rounded border p-3 ${style.card}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] ${style.badge}`}>
                          {item.severity}
                        </span>
                        <span className="text-sm font-medium text-neutral-900">{item.title}</span>
                      </div>
                      {citation && <span className="shrink-0 text-[10px] text-neutral-400">{citation}</span>}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-neutral-600">{item.explanation}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer branding — understated, no logo block */}
        <div className="mt-8 flex items-center justify-between border-t border-neutral-200 pt-3 text-[10px] text-neutral-400">
          <span>Analyzed by Contract Intelligence · contract-intelligence.example</span>
          <span>{analyzedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
      </div>
    </div>
  );
}
