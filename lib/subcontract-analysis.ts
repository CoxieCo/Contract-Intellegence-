// "Subcontract" extraction mode — Queensland construction subcontracts.
//
// Shared by app/api/analyze/route.ts (prompt + the post-processing applied
// before the save), app/page.tsx (the same post-processing applied to the
// streamed result before it's shown), the results view, and
// scripts/test-subcontract-extraction.mjs (which imports this file directly
// under Node's built-in TypeScript type stripping). That last consumer is
// why this file has no "@/" imports and only type-only relative imports:
// they're erased before Node ever resolves them.
//
// HARD RULE for this mode: only what the contract itself states. Nothing is
// ever calculated, inferred, or taken from the BIF Act or any other law. The
// system prompt says so, and enforceContractOnly() below re-checks it in
// code instead of trusting the model to comply.

import type { SourcedValue } from "./contract-analysis";

export type DocumentType = "contract" | "subcontract";

export function parseDocumentType(raw: unknown): DocumentType {
  return raw === "subcontract" ? "subcontract" : "contract";
}

// Every subcontract field carries the verbatim clause text separately from
// its extracted value. `quoteVerified` is set in code (never by the model):
// whether `quote` was actually found in the extracted PDF text.
export interface SubcontractField extends SourcedValue {
  quote: string;
  quoteVerified?: boolean;
}

export interface InsuranceRequirement extends SubcontractField {
  type: string;
  amount: string;
}

export interface NoticeDeadline extends SubcontractField {
  label: string;
}

export interface SubcontractParties {
  headContractorName: SubcontractField;
  headContractorABN: SubcontractField;
  subcontractorName: SubcontractField;
  siteAddress: SubcontractField;
  contractSum: SubcontractField;
}

export interface SubcontractProgressClaims {
  claimDayOrReferenceDates: SubcontractField;
  claimRecipient: SubcontractField;
  claimMethod: SubcontractField;
  requiredSupportingDocs: SubcontractField;
}

export interface SubcontractPaymentTerms {
  paymentPeriodAsWritten: SubcontractField;
  businessOrCalendarDays: SubcontractField;
}

export interface SubcontractRetention {
  retentionPercent: SubcontractField;
  retentionCap: SubcontractField;
  retentionReleaseTriggers: SubcontractField;
}

export interface SubcontractDefectsLiability {
  defectsLiabilityPeriod: SubcontractField;
}

export interface SubcontractTimeBars {
  variationNoticeDeadline: SubcontractField;
  extensionOfTimeNoticeDeadline: SubcontractField;
  delayClaimNoticeDeadline: SubcontractField;
  otherNoticeDeadlines: NoticeDeadline[];
}

export interface SubcontractInsuranceAndLicences {
  requiredInsurances: InsuranceRequirement[];
  licenceRequirements: SubcontractField;
}

export interface SubcontractTermination {
  terminationRights: SubcontractField;
  suspensionRights: SubcontractField;
}

export interface SubcontractDisputes {
  disputeResolutionClause: SubcontractField;
}

export interface SubcontractAnalysis {
  documentType: "subcontract";
  parties: SubcontractParties;
  progressClaims: SubcontractProgressClaims;
  paymentTerms: SubcontractPaymentTerms;
  retention: SubcontractRetention;
  defectsLiability: SubcontractDefectsLiability;
  timeBars: SubcontractTimeBars;
  insuranceAndLicences: SubcontractInsuranceAndLicences;
  termination: SubcontractTermination;
  disputes: SubcontractDisputes;
}

export function isSubcontractAnalysis(a: unknown): a is SubcontractAnalysis {
  return !!a && typeof a === "object" && (a as { documentType?: unknown }).documentType === "subcontract";
}

export const SUBCONTRACT_DISCLAIMER =
  "Dates and terms are taken from your contract only. This is not legal advice and does not calculate legal deadlines.";

// ---------- Section / field metadata (UI, scan checklist, prompt) ----------

export type SubcontractSectionId =
  | "parties"
  | "progressClaims"
  | "paymentTerms"
  | "retention"
  | "defectsLiability"
  | "timeBars"
  | "insuranceAndLicences"
  | "termination"
  | "disputes";

export interface SubcontractSectionMeta {
  id: SubcontractSectionId;
  title: string;
  // Scalar SubcontractField keys, in display order, with their labels.
  fields: Record<string, string>;
  // The one array field a section may have (rendered as one card per item).
  list?: { key: string; label: string };
}

export const SUBCONTRACT_SECTIONS: SubcontractSectionMeta[] = [
  {
    id: "parties",
    title: "Parties & contract sum",
    fields: {
      headContractorName: "Head contractor",
      headContractorABN: "Head contractor ABN",
      subcontractorName: "Subcontractor",
      siteAddress: "Site address",
      contractSum: "Contract sum",
    },
  },
  {
    id: "progressClaims",
    title: "Progress claims",
    fields: {
      claimDayOrReferenceDates: "Claim day / reference dates",
      claimRecipient: "Who to send claims to",
      claimMethod: "How to submit claims",
      requiredSupportingDocs: "Required supporting documents",
    },
  },
  {
    id: "paymentTerms",
    title: "Payment terms",
    fields: {
      paymentPeriodAsWritten: "Payment period (as written)",
      businessOrCalendarDays: "Business or calendar days",
    },
  },
  {
    id: "retention",
    title: "Retention",
    fields: {
      retentionPercent: "Retention percentage",
      retentionCap: "Retention cap",
      retentionReleaseTriggers: "Retention release",
    },
  },
  {
    id: "defectsLiability",
    title: "Defects liability",
    fields: { defectsLiabilityPeriod: "Defects liability period" },
  },
  {
    id: "timeBars",
    title: "Time bars & notices",
    fields: {
      variationNoticeDeadline: "Variation notice deadline",
      extensionOfTimeNoticeDeadline: "Extension of time notice deadline",
      delayClaimNoticeDeadline: "Delay claim notice deadline",
    },
    list: { key: "otherNoticeDeadlines", label: "Other notice deadlines" },
  },
  {
    id: "insuranceAndLicences",
    title: "Insurance & licences",
    fields: { licenceRequirements: "Licence requirements" },
    list: { key: "requiredInsurances", label: "Required insurances" },
  },
  {
    id: "termination",
    title: "Termination & suspension",
    fields: { terminationRights: "Termination rights", suspensionRights: "Suspension rights" },
  },
  {
    id: "disputes",
    title: "Disputes",
    fields: { disputeResolutionClause: "Dispute resolution" },
  },
];

// The order the model is asked to stream sections in — the scan checklist
// counts completed keys from the front of this list.
export const SUBCONTRACT_PARTIAL_KEYS: SubcontractSectionId[] = SUBCONTRACT_SECTIONS.map((s) => s.id);

// ---------- Prompt ----------

export const SUBCONTRACT_SYSTEM_PROMPT = `You extract terms from Queensland construction subcontracts for the subcontractor.

HARD RULE — this overrides every other instruction:
- Only extract what the contract document itself states, in its own words.
- Never calculate, infer, estimate, or mention any deadline, time limit, period, entitlement, or requirement under the Building Industry Fairness (Security of Payment) Act 2017 (Qld) ("BIF Act"), the Queensland Building and Construction Commission Act 1991 (Qld), or any other statute, regulation, or general law — not even when the contract is silent, not even when you know the statutory default, and not even when a contract term may be overridden or void under law.
- Never do date arithmetic or convert one period into another (for example, never turn "45 days after the end of the month" into "up to 75 days", and never turn days into weeks).
- If the contract itself refers to a statute, you may quote what the contract says, but add nothing about what the statute requires.
- Do not give legal advice, legal conclusions, or opinions on whether a term is fair, valid, or enforceable.`;

const FIELD_SHAPE = `{ "value": "...", "summary": "...", "quote": "...", "page": <number|null>, "section": "..."|null }`;

function fieldLines(fields: Record<string, string>, indent: string): string[] {
  return Object.keys(fields).map((k) => `${indent}"${k}": ${FIELD_SHAPE}`);
}

function schemaText(): string {
  const blocks = SUBCONTRACT_SECTIONS.map((s) => {
    const lines = fieldLines(s.fields, "    ");
    if (s.list?.key === "otherNoticeDeadlines") {
      lines.push(
        `    "otherNoticeDeadlines": [ { "label": "...", "value": "...", "summary": "...", "quote": "...", "page": <number|null>, "section": "..."|null } ]`
      );
    }
    if (s.list?.key === "requiredInsurances") {
      // requiredInsurances goes first in its section, matching SUBCONTRACT_SECTIONS' intent.
      lines.unshift(
        `    "requiredInsurances": [ { "type": "...", "amount": "...", "quote": "...", "page": <number|null>, "section": "..."|null } ]`
      );
    }
    return `  "${s.id}": {\n${lines.join(",\n")}\n  }`;
  });
  return `{\n  "documentType": "subcontract",\n${blocks.join(",\n")}\n}`;
}

export function buildSubcontractUserPrompt(pageMarkedText: string): string {
  return `Extract the subcontractor-relevant terms from the subcontract text below and return ONLY valid JSON (no markdown, no code fences, no preamble) matching this exact shape, with the keys in this order:

${schemaText()}

Every key above must be present. Rules — follow all of them exactly:

1. Only extract what this contract states. Never invent information, and never fill a gap from what similar contracts usually say or from what any law says (see the HARD RULE).
2. If a field is not stated in the contract, return exactly ${`{ "value": "Not found", "summary": "Not found", "quote": "", "page": null, "section": null }`} for it — do not omit it, leave it blank, or guess. For the two array fields, return [] if the contract states none.
3. "quote" must be copied character-for-character from the contract text: the shortest complete sentence or clause that states the term, including any condition or consequence in that same sentence (for example "failing which the Subcontractor shall have no entitlement..."). Do not paraphrase, correct, or join passages from different places — not even two adjacent clauses. If a term is spread over several clauses (for example, different termination rights in separate clauses), quote only the one clause that states the main term and name the other clause number(s) in "summary". Prefer a passage on a single page.
4. "value" is the specific term exactly as the contract words it, and must be copied from inside "quote" (a contiguous excerpt of it, or the whole quote). Examples: "5%", "45 days after the end of the month in which the payment claim is received", "Business Days". Never a calculated or converted figure.
5. "summary" is a short plain-language paraphrase of what the quote says, roughly 6-14 words. It must not add any fact, number, date, or condition that isn't in the quote, must not drop a condition that changes the meaning, must not calculate anything, and must not mention any law that the quote itself doesn't mention.
6. "businessOrCalendarDays" is the kind of days the contract uses for the payment period. "value" is the contract's own word(s) (e.g. "Business Days", "calendar days", "days"). If the contract defines that term, quote the definition. If the contract just says "days" with no definition, the value is "days" and the summary says the contract doesn't specify business or calendar days.
7. "claimDayOrReferenceDates" is when the contract says a progress claim may or must be made (a day of the month, a reference date, a milestone).
8. Time bars: "variationNoticeDeadline", "extensionOfTimeNoticeDeadline" and "delayClaimNoticeDeadline" are the time limits the contract sets for giving each notice, quoted with any stated consequence of missing it. "otherNoticeDeadlines" lists any other notice time limits the contract sets for the subcontractor (e.g. notice of a latent condition, notice of dispute, notice disputing a payment schedule) — "label" is a short name for the notice, in your words. Do not repeat the three named time bars there.
9. "requiredInsurances": one item per insurance the contract requires the subcontractor to hold. "type" is the insurance as named in the contract; "amount" is the amount exactly as written, or "Not stated" if the contract states none.
10. Many subcontracts put the actual numbers in a schedule, annexure, or "Item" table and refer to it from the general conditions. In that case quote the place where the actual number or term is stated, and cite that page.
11. If two clauses conflict on the same term, quote the one that states it most specifically and say in "summary" that clause <its label> says otherwise. Do not resolve the conflict yourself.
12. The contract text is divided into pages marked "--- PAGE N ---". Set "page" to the page where "quote" appears.
13. Set "section" to the clause or item label exactly as printed (e.g. "Clause 12.3", "Item 9") only if the text prints one; never invent one — use null otherwise.
14. Set "page" and "section" to null whenever the value is "Not found", or you cannot tell which page it came from. Never default to page 1.

Contract text:
${pageMarkedText}`;
}

// The assistant-turn prefill. Like the general contract prompt's "{" prefill
// (see app/api/analyze/route.ts), it makes a prose reply structurally very
// hard, and it guarantees the discriminator that tells every reader of a
// saved analysis which mode produced it.
export const SUBCONTRACT_PREFILL = '{"documentType": "subcontract",';

// ---------- Post-processing: enforce "contract only" in code ----------

const NOT_FOUND = "Not found";

function notFoundField(): SubcontractField {
  return { value: NOT_FOUND, summary: NOT_FOUND, quote: "", page: null, section: null };
}

export function isFieldFound(f: { value?: string } | undefined | null): boolean {
  return !!f && typeof f.value === "string" && f.value.trim() !== "" && f.value.trim().toLowerCase() !== "not found";
}

// Lowercase alphanumerics only — robust to the whitespace, line-wrap,
// hyphenation-spacing and smart-quote differences between the model's copy
// of a passage and pdf-parse's extraction of it.
function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface PageIndex {
  text: string; // squashed text of the whole document
  starts: { page: number; offset: number }[]; // offset in `text` where each page begins
}

function indexPages(pageMarkedText: string): PageIndex {
  const parts = pageMarkedText.split(/--- PAGE (\d+) ---/);
  // split with a capture group: [pre, num, body, num, body, ...]
  let text = "";
  const starts: PageIndex["starts"] = [];
  for (let i = 1; i < parts.length; i += 2) {
    starts.push({ page: Number(parts[i]), offset: text.length });
    text += squash(parts[i + 1] ?? "");
  }
  return { text, starts };
}

function pageAt(index: PageIndex, offset: number): number | null {
  let page: number | null = null;
  for (const s of index.starts) {
    if (s.offset <= offset) page = s.page;
    else break;
  }
  return page;
}

function pageText(index: PageIndex, page: number): string {
  const i = index.starts.findIndex((s) => s.page === page);
  if (i === -1) return "";
  return index.text.slice(index.starts[i].offset, index.starts[i + 1]?.offset ?? index.text.length);
}

// Every page a quote occurs on (by where each occurrence starts).
function pagesOfQuote(index: PageIndex, quote: string): number[] {
  const needle = squash(quote);
  if (needle.length < 4) return [];
  const pages: number[] = [];
  let from = 0;
  while (true) {
    const at = index.text.indexOf(needle, from);
    if (at === -1) break;
    const p = pageAt(index, at);
    if (p != null && !pages.includes(p)) pages.push(p);
    from = at + 1;
  }
  return pages;
}

// When a whole quote isn't found, but every sentence of it is found on its
// own, it's several genuine passages run together — returns the first.
function firstVerbatimSentence(index: PageIndex, quote: string): string | null {
  const sentences = quote.split(/(?<=[.;])\s+/).map((x) => x.trim()).filter((x) => squash(x).length >= 4);
  if (sentences.length < 2) return null;
  return sentences.every((x) => pagesOfQuote(index, x).length > 0) ? sentences[0] : null;
}

// Statutory references the model is told never to introduce. A field that
// mentions one of these in its value/summary when its own verbatim quote
// doesn't is, by definition, adding something the contract doesn't say.
const STATUTORY_PATTERNS: RegExp[] = [
  /\bBIF\s*Act\b/i,
  /building industry fairness/i,
  /security of payment/i,
  /\bQBCC\b/i,
  /queensland building and construction commission/i,
  /\bstatut(e|es|ory)\b/i,
  /\blegislat(ion|ive)\b/i,
  /\bunder the act\b/i,
];

function introducesStatute(text: string, quote: string): boolean {
  return STATUTORY_PATTERNS.some((re) => re.test(text) && !re.test(quote));
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asPage(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : null;
}

const QUOTE_FALLBACK_SUMMARY_LEN = 90;

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

function cleanField(raw: unknown, index: PageIndex, path: string, log: string[]): SubcontractField {
  if (!raw || typeof raw !== "object") return notFoundField();
  const r = raw as Record<string, unknown>;
  let value = asString(r.value).trim();
  let summary = asString(r.summary).trim();
  let quote = asString(r.quote).trim();
  let page = asPage(r.page);
  let section = typeof r.section === "string" && r.section.trim() ? r.section.trim() : null;

  if (!value || value.toLowerCase() === "not found") return notFoundField();

  // A value with no supporting quote can't be shown to have come from the
  // contract, so it isn't shown at all.
  if (!quote) {
    log.push(`${path}: dropped — no quote`);
    return notFoundField();
  }

  // "value" must be wording taken from the quote. If the model paraphrased
  // or calculated instead, fall back to the contract's own words.
  if (!squash(quote).includes(squash(value))) {
    log.push(`${path}: value not in quote, replaced with quote`);
    value = quote;
  }

  // No statute the contract itself doesn't mention.
  if (introducesStatute(value, quote)) {
    log.push(`${path}: value mentioned a statute the quote doesn't, replaced with quote`);
    value = quote;
  }
  if (introducesStatute(summary, quote)) {
    log.push(`${path}: summary mentioned a statute the quote doesn't, replaced`);
    summary = clip(quote, QUOTE_FALLBACK_SUMMARY_LEN);
  }
  if (!summary) summary = clip(value, QUOTE_FALLBACK_SUMMARY_LEN);

  // Cite the page the quote is actually on.
  let pages = pagesOfQuote(index, quote);
  // A quote stitched together from separate verbatim passages (despite rule
  // 3) is cut back to its first one, so the citation still points at — and
  // highlights — real contract text.
  if (pages.length === 0) {
    const first = firstVerbatimSentence(index, quote);
    if (first) {
      log.push(`${path}: quote joined separate passages, trimmed to the first`);
      quote = first;
      pages = pagesOfQuote(index, quote);
      if (!squash(quote).includes(squash(value))) value = quote;
    }
  }
  const quoteVerified = pages.length > 0;
  if (quoteVerified && (page == null || !pages.includes(page))) {
    log.push(`${path}: page ${page} corrected to ${pages[0]}`);
    page = pages[0];
  }
  if (!quoteVerified) log.push(`${path}: quote not found in extracted text`);

  // A section label must be printed on the cited page — the model sometimes
  // adds a "Clause" the document never prints in front of a bare "2.2".
  if (section && page != null) {
    const text = pageText(index, page);
    const bare = section.replace(/^(clause|section|cl\.?)\s+/i, "");
    const printed = [section, bare].find((s) => squash(s).length > 0 && text.includes(squash(s)));
    if (printed !== section) log.push(`${path}: section "${section}" not printed on page ${page}${printed ? `, using "${printed}"` : ", dropped"}`);
    section = printed ?? null;
  }

  return { value, summary, quote, page, section, quoteVerified };
}

function cleanInsurance(raw: unknown, index: PageIndex, path: string, log: string[]): InsuranceRequirement | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = asString(r.type).trim();
  const amountRaw = asString(r.amount).trim();
  if (!type) return null;
  const quote = asString(r.quote).trim();
  // Same rule as every other field: the amount must be the contract's own
  // wording, or explicitly not stated.
  const amount = !amountRaw || /^not stated$/i.test(amountRaw) || !squash(quote).includes(squash(amountRaw)) ? "Not stated" : amountRaw;
  const base = cleanField(
    { value: type, summary: amount === "Not stated" ? `${type} — amount not stated` : `${type}: ${amount}`, quote, page: r.page, section: r.section },
    index,
    path,
    log
  );
  if (!isFieldFound(base)) return null;
  return { ...base, type, amount };
}

function cleanNotice(raw: unknown, index: PageIndex, path: string, log: string[]): NoticeDeadline | null {
  if (!raw || typeof raw !== "object") return null;
  const label = asString((raw as Record<string, unknown>).label).trim() || "Notice";
  const base = cleanField(raw, index, path, log);
  if (!isFieldFound(base)) return null;
  // The label is the model's own short name for the notice, so it gets the
  // same no-statute check as a summary.
  return { ...base, label: introducesStatute(label, base.quote) ? "Notice" : label };
}

// Normalizes a parsed model response into a complete SubcontractAnalysis:
// every field present (missing ones filled with "Not found"), each value
// checked against its quote, statutory content the contract doesn't contain
// removed, and each page corrected to where the quote actually appears.
// Deterministic, so the server's saved copy and the client's displayed copy
// of the same response always match.
export function enforceContractOnly(
  raw: Record<string, unknown>,
  pageMarkedText: string,
  log: string[] = []
): SubcontractAnalysis {
  const index = indexPages(pageMarkedText);
  const out: Record<string, unknown> = { documentType: "subcontract" };

  for (const s of SUBCONTRACT_SECTIONS) {
    const src = (raw[s.id] && typeof raw[s.id] === "object" ? raw[s.id] : {}) as Record<string, unknown>;
    const sec: Record<string, unknown> = {};
    for (const key of Object.keys(s.fields)) {
      sec[key] = cleanField(src[key], index, `${s.id}.${key}`, log);
    }
    if (s.list) {
      const items = Array.isArray(src[s.list.key]) ? (src[s.list.key] as unknown[]) : [];
      const clean = s.list.key === "requiredInsurances" ? cleanInsurance : cleanNotice;
      sec[s.list.key] = items
        .map((item, i) => clean(item, index, `${s.id}.${s.list!.key}[${i}]`, log))
        .filter((x): x is InsuranceRequirement & NoticeDeadline => x !== null);
    }
    out[s.id] = sec;
  }

  return out as unknown as SubcontractAnalysis;
}
