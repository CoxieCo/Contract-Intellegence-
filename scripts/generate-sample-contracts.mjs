// One-off generator for app/components/landing/sampleContracts.ts.
//
// Runs the three demo PDFs (a commercial lease, a SaaS/vendor MSA, a mutual
// NDA) through the SAME extraction steps app/api/analyze/route.ts uses —
// pdf-parse with pageJoiner:"" + "--- PAGE N ---" headers, then Claude with
// the identical model, params, prompt and "{" prefill — and writes the
// genuine parsed output as a static TS module. It is NOT wired into the app
// and never runs at request time; re-run it by hand to refresh the samples:
//
//   node --env-file=.env.local scripts/generate-sample-contracts.mjs \
//     ~/Downloads/lease.pdf ~/Downloads/saas.pdf ~/Downloads/nda.pdf
//
// The prompt/model below are copied verbatim from app/api/analyze/route.ts —
// keep them in sync if that route's extraction prompt changes.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PDFParse } from "pdf-parse";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const OUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "app",
  "components",
  "landing",
  "sampleContracts.ts"
);

// id/blurb are the only hand-authored bits — everything under `analysis`
// and the pageCount come straight from the pipeline run.
const SAMPLES = [
  {
    argIndex: 0,
    id: "lease",
    fileName: "Commercial_Lease_Agreement.pdf",
    label: "Commercial lease",
    blurb:
      "A three-year retail lease with a fixed renewal-notice window, annual CPI-or-4% rent reviews and a holding-over penalty.",
  },
  {
    argIndex: 1,
    id: "saas",
    fileName: "Master_Services_Agreement.pdf",
    label: "Vendor / SaaS agreement",
    blurb:
      "A cloud platform MSA that auto-renews yearly unless cancelled 60 days out, with an SLA-credit-only remedy and a 3-month liability cap.",
  },
  {
    argIndex: 2,
    id: "nda",
    fileName: "Mutual_NDA.pdf",
    label: "Mutual NDA",
    blurb:
      "A two-year mutual non-disclosure agreement whose confidentiality obligations survive for seven years from disclosure.",
  },
];

function buildPrompt(pageMarkedText) {
  return `You are a contract analysis assistant. Extract structured information from the contract text below and return ONLY valid JSON (no markdown, no code fences, no preamble) matching this exact shape:

{
  "contractOverview": {
    "contractName": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "contractType": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "parties": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "status": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "purpose": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null }
  },
  "importantDates": {
    "startDate": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "endDate": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "renewalDate": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "noticePeriod": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "noticeDeadline": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "autoRenewal": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null }
  },
  "commercialTerms": {
    "contractValue": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "currency": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "paymentTerms": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "paymentFrequency": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "pricing": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "priceEscalation": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "minimumCommitments": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "latePaymentTerms": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null }
  },
  "keyClauses": {
    "termination": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "earlyTermination": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "liability": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "liabilityCap": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "governingLaw": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "assignment": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "changeOfControl": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "ndaConfidentiality": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "dataComplianceObligations": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null },
    "slaCommitments": { "value": "...", "summary": "...", "page": <number|null>, "section": "..."|null }
  },
  "thingsToWatch": [
    { "title": "short title", "severity": "HIGH" | "MEDIUM" | "LOW", "explanation": "...", "quote": "...", "page": <number|null>, "section": "..."|null }
  ]
}

Every field above must be present. Extraction rules — follow all of these exactly:

1. Never invent information that is not present in the contract.
2. If a field's value cannot be found in the contract, set its "value" to the literal string "Not found" and its "summary" to "Not found" too — do not omit the field, leave it blank, or guess.
3. Preserve dates exactly as they appear (or as unambiguously implied by explicit terms) — do not reformat away precision or invent a date.
4. Preserve monetary values and currencies exactly as stated.
5. Distinguish between explicit contract terms and your own interpretation; do not present an inference as if it were stated in the contract.
6. Do not provide definitive legal advice or legal conclusions of any kind.
7. For "thingsToWatch", only include an item if it clears one of these concrete bars — do not include anything that doesn't:
   - a renewal, option, or notice deadline that falls within 12 months of the contract's start/execution date, or a notice period shorter than 30 days
   - automatic/evergreen renewal with no cap on the number of renewal cycles, or requiring the disadvantaged party to act to prevent renewal
   - a price/fee escalation clause allowing an increase of more than 5% in a single adjustment, or with no cap stated at all
   - a minimum commitment or take-or-pay obligation lasting longer than 12 months, or with no early-exit mechanism
   - a termination-for-convenience right held by only one party, or a termination clause requiring more than 90 days notice
   - a liability cap set below 12 months of fees, or unlimited liability for either party, or a carve-out from the cap that is broad rather than the usual short list (IP infringement, confidentiality, gross negligence)
   - an indemnification, audit, or compliance obligation with no cap on scope, cost, or duration
   - any term that is internally inconsistent or contradicted elsewhere in the contract (see rule 9)
   Do not flag a provision merely because the category (e.g. "has a termination clause," "has a liability cap") is present — only flag it when the specific number, party asymmetry, or absence of a limit in this contract crosses one of the bars above. When in doubt, leave it out rather than including a borderline or generic item. Never declare something legally invalid, unlawful, or definitively "bad" — frame every item as something worth reviewing, not a legal verdict.
8. Do not infer a contract term just because it is common in similar contracts — only extract what this contract actually says.
9. If multiple clauses affect the same field (e.g. conflicting termination or liability provisions), note the conflict explicitly in that field's "value" rather than silently picking one.
10. The contract text below is divided into pages marked with "--- PAGE N ---" headers. When you extract a field's value, set "page" to the exact page number (matching one of those markers) where that value or clause actually appears. If the same fact is stated on more than one page, cite the page with the clearest/primary statement of it.
11. Set "section" to the clause or section label EXACTLY as it is printed in the text (e.g. "Section 7.3", "Clause 13.2") only if the text explicitly labels it that way. Never invent, number, or guess a section label that isn't printed in the source text — if none is printed, use null.
12. Set both "page" and "section" to the literal JSON value null (never 0, never an empty string, never a guess) whenever: the field's "value" is "Not found", OR the value was found but you cannot confidently identify which specific page it came from. Do not default to page 1 as a fallback.
13. Apply the same page/section rules to every "thingsToWatch" item, based on the clause(s) the observation is drawn from. Also set "quote" to the exact clause text as printed (verbatim, for citation purposes, same as rule 14 below) that the observation is actually about — "explanation" is your own analysis of why it's worth flagging and is never itself a quote, so "quote" carries the real source text separately. If the observation is drawn from more than one clause, quote the single passage that most directly supports it, not a combination of several. If no specific clause can be pinned down (rare, since every item must already be tied to a concrete provision to qualify under rule 7), set "quote" to an empty string and "page"/"section" to null.
14. "value" must be the exact clause text as printed in the contract (verbatim, for citation purposes) — do not paraphrase, shorten, or summarize it. "summary" must be a short, faithful paraphrase of "value" in your own plain-language words, roughly 6-14 words (under about 90 characters), for quick scanning. It must not add any fact, number, date, party, or condition absent from "value", and must not drop a condition that flips the meaning (e.g. don't drop "only if renewed early"). If "value" is already short (a single date, a name, a number), "summary" may simply repeat it verbatim.

Field priority: the following fields are the most important to get right — contractOverview.parties, contractOverview.contractType, importantDates.startDate, importantDates.endDate, importantDates.renewalDate, importantDates.noticePeriod, importantDates.autoRenewal, commercialTerms.paymentTerms, commercialTerms.priceEscalation, keyClauses.termination, keyClauses.liabilityCap, keyClauses.governingLaw, and thingsToWatch. Still attempt every other field in the schema, using "Not found" where the contract doesn't say.

Contract text:
${pageMarkedText}`;
}

function parseAnalysisJson(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, "").replace(/```$/, "").trim();
  }
  return JSON.parse(cleaned);
}

async function runSample(sample, pdfPath) {
  const buffer = await readFile(pdfPath);
  const parser = new PDFParse({ data: buffer });
  const pdfData = await parser.getText({ pageJoiner: "" });
  const pageMarkedText = pdfData.pages.map((p) => `--- PAGE ${p.num} ---\n${p.text}`).join("\n\n");
  const pageCount = pdfData.pages.length;

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
    temperature: 0,
    messages: [
      { role: "user", content: buildPrompt(pageMarkedText) },
      { role: "assistant", content: "{" },
    ],
  });

  let full = "{";
  stream.on("text", (delta) => {
    full += delta;
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "max_tokens") {
    throw new Error(`${sample.id}: response truncated at max_tokens`);
  }

  const analysis = parseAnalysisJson(full);
  console.log(
    `  ${sample.id}: ${pageCount} page(s), ${(analysis.thingsToWatch ?? []).length} things to watch`
  );
  // pageMarkedText is what /api/analyze persists as contract_text and what
  // /api/ask needs verbatim (its "--- PAGE N ---" headers back the citation
  // page numbers) — carrying it lets "Ask your contract" work on a sample
  // exactly as it does on a real scan.
  return { ...sample, pageCount, analysis, contractText: pageMarkedText };
}

async function main() {
  const pdfArgs = process.argv.slice(2);
  if (pdfArgs.length !== SAMPLES.length) {
    console.error(`Expected ${SAMPLES.length} PDF paths (lease, saas, nda), got ${pdfArgs.length}`);
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set — run with: node --env-file=.env.local ...");
    process.exit(1);
  }

  const results = [];
  for (const sample of SAMPLES) {
    console.log(`Running ${sample.id} (${pdfArgs[sample.argIndex]})…`);
    results.push(await runSample(sample, pdfArgs[sample.argIndex]));
  }

  const modules = results.map((r) => {
    const { argIndex, ...keep } = r;
    void argIndex;
    return keep;
  });

  const file = `// GENERATED — do not edit by hand.
//
// Real output from the app's extraction pipeline (pdf-parse + Claude, same
// model/prompt as app/api/analyze/route.ts), run once over the three demo
// contract PDFs. Regenerate with scripts/generate-sample-contracts.mjs.
//
// Generated ${new Date().toISOString()}

import type { ContractAnalysis } from "@/lib/contract-analysis";

export interface SampleContract {
  /** Stable id used as the drag payload and React key. */
  id: string;
  /** Display name shown on the card, confirm card and results header. */
  fileName: string;
  /** Short human label for the card heading (e.g. "Commercial lease"). */
  label: string;
  /** One or two sentences describing the contract, for the descriptive card. */
  blurb: string;
  /** Real page count from pdf-parse. */
  pageCount: number;
  /** Genuine parsed extraction output — drives the real ResultsView. */
  analysis: ContractAnalysis;
  /**
   * The page-marked contract text (same "--- PAGE N ---" form /api/analyze
   * persists and /api/ask consumes) so "Ask your contract" works on a sample.
   */
  contractText: string;
}

export const SAMPLE_CONTRACTS: SampleContract[] = ${JSON.stringify(modules, null, 2)};
`;

  await writeFile(OUT_PATH, file);
  console.log(`\nWrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
