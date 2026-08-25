import type { ContractAnalysis, ThingToWatch } from "@/lib/contract-analysis";
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

interface KeyFact {
  label: string;
  value: string;
}

// Same priority fields and "Not found" skip rule as the results view's Quick
// Scan zone — this is a condensed version of that list, not a new selection.
function buildKeyFacts(analysis: ContractAnalysis): KeyFact[] {
  const facts: KeyFact[] = [];
  const dates = analysis.importantDates;
  const terms = analysis.commercialTerms;
  const clauses = analysis.keyClauses;

  if (!notFound(dates?.renewalDate?.value)) facts.push({ label: "Renewal date", value: dates!.renewalDate.value });
  if (!notFound(dates?.noticePeriod?.value)) facts.push({ label: "Notice period", value: dates!.noticePeriod.value });
  if (!notFound(dates?.autoRenewal?.value)) facts.push({ label: "Auto-renewal", value: dates!.autoRenewal.value });
  if (!notFound(terms?.priceEscalation?.value))
    facts.push({ label: "Price escalation", value: terms!.priceEscalation.value });
  if (!notFound(clauses?.termination?.value)) facts.push({ label: "Termination", value: clauses!.termination.value });
  if (!notFound(clauses?.liabilityCap?.value)) facts.push({ label: "Liability cap", value: clauses!.liabilityCap.value });

  return facts;
}

// Rendered off-screen at all times (`hidden print:block`) rather than
// mounted on demand — @media print in globals.css does the actual work of
// hiding the rest of the app and pulling this element into view, so there's
// no visibility state to coordinate with the Export PDF button's click.
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

  const keyFacts = buildKeyFacts(analysis);

  const topWatchItems = [...(analysis.thingsToWatch ?? [])]
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    .slice(0, 5);

  return (
    <div id="print-summary-root" className="hidden bg-white text-neutral-900 print:block">
      <div className="mx-auto max-w-3xl px-10 py-10">
        {/* Contract identity */}
        <div className="border-b border-neutral-200 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Contract summary</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">{title}</h1>
          {subline && <p className="mt-1 text-sm text-neutral-500">{subline}</p>}
          {!notFound(overview?.status?.value) && (
            <span className="mt-2 inline-flex items-center rounded border border-neutral-300 px-2 py-0.5 text-xs font-medium text-neutral-600">
              {overview!.status.value}
            </span>
          )}
        </div>

        {/* Key facts — stacked label-above-value, not side-by-side: some of
            these (termination, price escalation) are full clause sentences
            rather than short data points, and right-aligned wrapped prose
            reads as ragged and hard to scan. */}
        {keyFacts.length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Key facts</p>
            <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-3">
              {keyFacts.map((fact) => (
                <div key={fact.label} className="break-inside-avoid border-b border-neutral-100 pb-2">
                  <p className="text-xs text-neutral-500">{fact.label}</p>
                  <p className="mt-0.5 text-sm font-medium leading-5 text-neutral-900">{fact.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Things to watch — top 5, high severity first */}
        {topWatchItems.length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Things to watch</p>
            <div className="mt-2 space-y-2.5">
              {topWatchItems.map((item, i) => {
                const style = SEVERITY_PRINT[item.severity];
                return (
                  <div key={i} className={`break-inside-avoid rounded border p-3 ${style.card}`}>
                    <div className="flex items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.04em] ${style.badge}`}>
                        {item.severity}
                      </span>
                      <span className="text-sm font-medium text-neutral-900">{item.title}</span>
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
