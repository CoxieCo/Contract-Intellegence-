// Runs the Subcontract-mode fixtures in /test-fixtures through the same
// extraction app/api/analyze/route.ts runs for documentType "subcontract"
// (pdf-parse with pageJoiner:"" + "--- PAGE N ---" headers, then Claude with
// the identical model, params, system prompt, user prompt and prefill, then
// enforceContractOnly()), and checks every field against the fixture's
// .expected.json ground truth:
//
//   node --env-file=.env.local scripts/test-subcontract-extraction.mjs
//
// For each field: found (or "Not found" where the contract is silent), cited
// on the right page, quote containing the expected wording, quote verified
// against the PDF text, and the quote locatable by lib/pdfHighlight.ts in
// pdf.js's text items for that page — the same match PdfViewer uses to
// highlight a citation. Also reports every time enforceContractOnly() had to
// correct the model. Exits non-zero on any failure.
//
// It imports the TypeScript modules in lib/ directly (Node's built-in type
// stripping), so the prompt and enforcement can't drift from the app's. It
// calls the Anthropic API (two requests) but never touches Supabase.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { PDFParse } from "pdf-parse";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  SUBCONTRACT_PREFILL,
  SUBCONTRACT_SYSTEM_PROMPT,
  buildSubcontractUserPrompt,
  enforceContractOnly,
  isFieldFound,
} from "../lib/subcontract-analysis.ts";
import { findHighlightRanges } from "../lib/pdfHighlight.ts";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test-fixtures");
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const STATUTE = /\bBIF\s*Act\b|building industry fairness|security of payment|\bstatut(e|es|ory)\b|\blegislat/i;

async function pdfTextItems(buffer) {
  const doc = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages[n] = content.items.filter((i) => "str" in i).map((i) => ({ str: i.str, hasEOL: i.hasEOL }));
  }
  return pages;
}

function checkOne(label, field, exp, pdfItems, failures) {
  const problems = [];
  if (exp === null) {
    if (isFieldFound(field)) problems.push(`expected Not found, got "${field.value}" (p.${field.page})`);
  } else if (!isFieldFound(field)) {
    problems.push("expected a value, got Not found");
  } else {
    if (!exp.pages.includes(field.page)) problems.push(`page ${field.page}, expected ${exp.pages.join(" or ")}`);
    for (const ph of exp.phrases) if (!squash(field.quote).includes(squash(ph))) problems.push(`quote lacks "${ph}"`);
    for (const ph of exp.forbid ?? []) if (squash(field.quote + field.value).includes(squash(ph))) problems.push(`used decoy "${ph}"`);
    if (exp.amount && !String(field.amount).includes(exp.amount)) problems.push(`amount "${field.amount}", expected it to contain "${exp.amount}"`);
    if (!field.quoteVerified) problems.push("quote not found in extracted text");
    if (field.page && findHighlightRanges(pdfItems[field.page] ?? [], field.quote).length === 0) problems.push("PdfViewer highlight would not match");
    for (const t of [field.value, field.summary]) {
      if (STATUTE.test(t) && !STATUTE.test(field.quote)) problems.push(`mentions a statute the quote doesn't: "${t}"`);
    }
  }
  const shown = isFieldFound(field) ? `p.${field.page} ${field.section ?? "-"} | ${field.summary}` : "Not found";
  console.log(`  ${problems.length ? "FAIL" : "ok  "} ${label}: ${shown}`);
  if (problems.length) {
    for (const p of problems) console.log(`         - ${p}`);
    if (isFieldFound(field)) console.log(`         quote: "${field.quote}"`);
    failures.push(label);
  }
}

let totalFailures = 0;
const files = (await readdir(FIXTURES)).filter((f) => f.endsWith(".expected.json"));
for (const f of files) {
  const truth = JSON.parse(await readFile(path.join(FIXTURES, f), "utf8"));
  const buffer = await readFile(path.join(FIXTURES, truth.file));
  console.log(`\n=== ${truth.file} ===`);

  const pdf = await new PDFParse({ data: buffer }).getText({ pageJoiner: "" });
  const pageMarkedText = pdf.pages.map((p) => `--- PAGE ${p.num} ---\n${p.text}`).join("\n\n");

  const message = await anthropic.messages
    .stream({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      temperature: 0,
      system: SUBCONTRACT_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildSubcontractUserPrompt(pageMarkedText) },
        { role: "assistant", content: SUBCONTRACT_PREFILL },
      ],
    })
    .finalMessage();
  const text = SUBCONTRACT_PREFILL + message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  console.log(`  (stop_reason ${message.stop_reason}, ${message.usage.output_tokens} output tokens)`);

  const log = [];
  const analysis = enforceContractOnly(JSON.parse(text), pageMarkedText, log);
  console.log(log.length ? `  enforcement corrections:\n${log.map((l) => `    * ${l}`).join("\n")}` : "  enforcement corrections: none");

  const pdfItems = await pdfTextItems(buffer);
  const failures = [];
  for (const [key, exp] of Object.entries(truth.expected)) {
    const [section, name] = key.split(".");
    const value = analysis[section][name];
    if (exp && exp.list) {
      // Each expected item must be matched by a distinct extracted item.
      const items = [...value];
      exp.list.forEach((e, i) => {
        const idx = items.findIndex((it) => e.phrases.every((ph) => squash(it.quote).includes(squash(ph))));
        const it = idx >= 0 ? items.splice(idx, 1)[0] : { value: "Not found", quote: "", page: null, section: null };
        checkOne(`${key}[${i}]${it.type || it.label ? ` (${it.type || it.label})` : ""}`, it, e, pdfItems, failures);
      });
      for (const extra of items) console.log(`  note ${key}: extra item p.${extra.page} "${extra.type || extra.label}" — ${extra.summary}`);
    } else {
      checkOne(key, value, exp, pdfItems, failures);
    }
  }
  console.log(`  ${failures.length === 0 ? "ALL FIELDS PASS" : `${failures.length} FAILED`}`);
  totalFailures += failures.length;
}

process.exit(totalFailures === 0 ? 0 : 1);
