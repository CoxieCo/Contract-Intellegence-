import {
  SUBCONTRACT_DISCLAIMER,
  SUBCONTRACT_SECTIONS,
  isFieldFound,
  type InsuranceRequirement,
  type NoticeDeadline,
  type SubcontractAnalysis,
  type SubcontractField,
} from "@/lib/subcontract-analysis";

// The print/"Export Analysis" document for a Subcontract-mode analysis —
// same off-screen #print-summary-root mechanism and look as
// ContractSummaryPrint, over the subcontract categories. Like that
// component, it prints the exact contract text (the verbatim quote) for
// every field, never only the summary, and carries the same disclaimer as
// the results view.

function citationLabel(source: { page: number | null; section: string | null }): string | null {
  const parts = [source.page != null ? `p. ${source.page}` : null, source.section ?? null].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function FieldRow({ label, field }: { label: string; field: SubcontractField | undefined }) {
  const found = !!field && isFieldFound(field);
  const citation = found ? citationLabel(field!) : null;
  return (
    <div className="break-inside-avoid border-b border-neutral-100 pb-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-neutral-500">{label}</p>
        {citation && <p className="shrink-0 text-[10px] text-neutral-400">{citation}</p>}
      </div>
      {found ? (
        <>
          <p className="mt-0.5 text-sm font-medium leading-5 text-neutral-900">{field!.summary || field!.value}</p>
          <p className="mt-0.5 text-xs leading-5 text-neutral-600">“{field!.quote}”</p>
        </>
      ) : (
        <p className="mt-0.5 text-sm italic leading-5 text-neutral-400">Not found</p>
      )}
    </div>
  );
}

export default function SubcontractSummaryPrint({
  analysis,
  fileName,
  analyzedAt,
}: {
  analysis: SubcontractAnalysis;
  fileName: string;
  analyzedAt: Date;
}) {
  const parties = analysis.parties;
  const subline = [parties?.headContractorName, parties?.subcontractorName]
    .filter((f) => f && isFieldFound(f))
    .map((f) => f!.value)
    .join(" · ");

  return (
    <div id="print-summary-root" className="hidden bg-white text-neutral-900 print:block">
      <div className="mx-auto max-w-3xl px-10 py-10">
        <div className="border-b border-neutral-200 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Subcontract analysis</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">{fileName}</h1>
          {subline && <p className="mt-1 text-sm text-neutral-500">{subline}</p>}
          <p className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{SUBCONTRACT_DISCLAIMER}</p>
        </div>

        {SUBCONTRACT_SECTIONS.map((meta) => {
          const sec = analysis[meta.id] as unknown as Record<string, unknown> | undefined;
          const items = meta.list && Array.isArray(sec?.[meta.list.key]) ? (sec![meta.list.key] as (InsuranceRequirement | NoticeDeadline)[]) : [];
          return (
            <div key={meta.id} className="mt-6 break-before-auto">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{meta.title}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-3">
                {Object.entries(meta.fields).map(([key, label]) => (
                  <FieldRow key={key} label={label} field={sec?.[key] as SubcontractField | undefined} />
                ))}
                {meta.list && items.length === 0 && <FieldRow label={meta.list.label} field={undefined} />}
                {items.map((item, i) => (
                  <FieldRow key={`${meta.list!.key}.${i}`} label={"type" in item ? item.type : item.label} field={item} />
                ))}
              </div>
            </div>
          );
        })}

        <div className="mt-8 flex items-center justify-between border-t border-neutral-200 pt-3 text-[10px] text-neutral-400">
          <span>Analyzed by Contract Intelligence · contract-intelligence.example</span>
          <span>{analyzedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</span>
        </div>
      </div>
    </div>
  );
}
