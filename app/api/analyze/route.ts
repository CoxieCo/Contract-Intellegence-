import { NextRequest, NextResponse, after } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PDFParse } from "pdf-parse";
import { supabase } from "@/lib/supabase";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { getSessionId } from "@/lib/session";
import { STREAM_CONTRACT_TEXT_DELIMITER } from "@/lib/contract-analysis";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Mirrors MAX_FILE_SIZE_BYTES in app/page.tsx — that check is client-side
// only (trivially bypassed by calling this route directly), so it's
// re-enforced here before the file ever reaches pdf-parse or Claude.
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

// Mirrors the client's parseAnalysis() in app/page.tsx — Claude is asked for
// raw JSON but sometimes wraps it in a code fence anyway.
function parseAnalysisJson(text: string): Record<string, unknown> | null {
  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```[a-zA-Z]*\n/, "")
      .replace(/```$/, "")
      .trim();
  }

  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  // Temporary stage timing — see prompt "Diagnose and Fix Analysis Speed".
  // Remove once the 60s slowdown is diagnosed and fixed.
  const requestStart = Date.now();
  try {
    const ip = getClientIp(req.headers);
    const rateLimitStart = Date.now();
    const allowed = await checkRateLimit(ip, "analyze");
    console.log(`[timing] rate-limit check: ${Date.now() - rateLimitStart}ms`);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many analysis requests. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      // A body past proxy.ts's buffer cap (next.config.ts's
      // proxyClientMaxBodySize) gets silently truncated before it reaches
      // here, which breaks multipart parsing. The practical cause is the
      // same "file too large" case as the explicit check below, so it gets
      // the same clean response instead of falling through to the generic
      // 500 in the outer catch.
      return NextResponse.json(
        { error: "That PDF is larger than 15MB. Try a smaller file." },
        { status: 413 }
      );
    }
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "That PDF is larger than 15MB. Try a smaller file." },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const extractionStart = Date.now();
    const parser = new PDFParse({ data: buffer });
    // pageJoiner: "" suppresses pdf-parse's built-in "-- N of M --" page-boundary
    // marker so we can insert our own unambiguous "--- PAGE N ---" headers below.
    const pdfData = await parser.getText({ pageJoiner: "" });
    const contractText = pdfData.text;
    console.log(`[timing] PDF extraction: ${Date.now() - extractionStart}ms`);

    if (!contractText || contractText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from PDF (it may be a scanned image)" },
        { status: 422 }
      );
    }

    const pageMarkedText = pdfData.pages
      .map((p) => `--- PAGE ${p.num} ---\n${p.text}`)
      .join("\n\n");

    const claudeStart = Date.now();
    const anthropicStream = anthropic.messages.stream({
      model: "claude-sonnet-4-5",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `You are a contract analysis assistant. Extract structured information from the contract text below and return ONLY valid JSON (no markdown, no code fences, no preamble) matching this exact shape:

{
  "contractOverview": {
    "contractName": { "value": "...", "page": <number|null>, "section": "..."|null },
    "contractType": { "value": "...", "page": <number|null>, "section": "..."|null },
    "parties": { "value": "...", "page": <number|null>, "section": "..."|null },
    "status": { "value": "...", "page": <number|null>, "section": "..."|null },
    "purpose": { "value": "...", "page": <number|null>, "section": "..."|null }
  },
  "importantDates": {
    "startDate": { "value": "...", "page": <number|null>, "section": "..."|null },
    "endDate": { "value": "...", "page": <number|null>, "section": "..."|null },
    "renewalDate": { "value": "...", "page": <number|null>, "section": "..."|null },
    "noticePeriod": { "value": "...", "page": <number|null>, "section": "..."|null },
    "noticeDeadline": { "value": "...", "page": <number|null>, "section": "..."|null },
    "autoRenewal": { "value": "...", "page": <number|null>, "section": "..."|null }
  },
  "commercialTerms": {
    "contractValue": { "value": "...", "page": <number|null>, "section": "..."|null },
    "currency": { "value": "...", "page": <number|null>, "section": "..."|null },
    "paymentTerms": { "value": "...", "page": <number|null>, "section": "..."|null },
    "paymentFrequency": { "value": "...", "page": <number|null>, "section": "..."|null },
    "pricing": { "value": "...", "page": <number|null>, "section": "..."|null },
    "priceEscalation": { "value": "...", "page": <number|null>, "section": "..."|null },
    "minimumCommitments": { "value": "...", "page": <number|null>, "section": "..."|null },
    "latePaymentTerms": { "value": "...", "page": <number|null>, "section": "..."|null }
  },
  "keyClauses": {
    "termination": { "value": "...", "page": <number|null>, "section": "..."|null },
    "earlyTermination": { "value": "...", "page": <number|null>, "section": "..."|null },
    "liability": { "value": "...", "page": <number|null>, "section": "..."|null },
    "liabilityCap": { "value": "...", "page": <number|null>, "section": "..."|null },
    "governingLaw": { "value": "...", "page": <number|null>, "section": "..."|null },
    "assignment": { "value": "...", "page": <number|null>, "section": "..."|null },
    "changeOfControl": { "value": "...", "page": <number|null>, "section": "..."|null },
    "ndaConfidentiality": { "value": "...", "page": <number|null>, "section": "..."|null },
    "dataComplianceObligations": { "value": "...", "page": <number|null>, "section": "..."|null },
    "slaCommitments": { "value": "...", "page": <number|null>, "section": "..."|null }
  },
  "thingsToWatch": [
    { "title": "short title", "severity": "HIGH" | "MEDIUM" | "LOW", "explanation": "...", "page": <number|null>, "section": "..."|null }
  ]
}

Every field above must be present. Extraction rules — follow all of these exactly:

1. Never invent information that is not present in the contract.
2. If a field's value cannot be found in the contract, set its "value" to the literal string "Not found" — do not omit the field, leave it blank, or guess.
3. Preserve dates exactly as they appear (or as unambiguously implied by explicit terms) — do not reformat away precision or invent a date.
4. Preserve monetary values and currencies exactly as stated.
5. Distinguish between explicit contract terms and your own interpretation; do not present an inference as if it were stated in the contract.
6. Do not provide definitive legal advice or legal conclusions of any kind.
7. For "thingsToWatch", identify provisions that require attention or review (upcoming renewals, short notice deadlines, automatic renewal, large price increases, long minimum commitments, difficult termination conditions, significant obligations, liability provisions worth reviewing, unusual conditions). Never declare something legally invalid, unlawful, or definitively "bad" — frame every item as something worth reviewing, not a legal verdict.
8. Do not infer a contract term just because it is common in similar contracts — only extract what this contract actually says.
9. If multiple clauses affect the same field (e.g. conflicting termination or liability provisions), note the conflict explicitly in that field's "value" rather than silently picking one.
10. The contract text below is divided into pages marked with "--- PAGE N ---" headers. When you extract a field's value, set "page" to the exact page number (matching one of those markers) where that value or clause actually appears. If the same fact is stated on more than one page, cite the page with the clearest/primary statement of it.
11. Set "section" to the clause or section label EXACTLY as it is printed in the text (e.g. "Section 7.3", "Clause 13.2") only if the text explicitly labels it that way. Never invent, number, or guess a section label that isn't printed in the source text — if none is printed, use null.
12. Set both "page" and "section" to the literal JSON value null (never 0, never an empty string, never a guess) whenever: the field's "value" is "Not found", OR the value was found but you cannot confidently identify which specific page it came from. Do not default to page 1 as a fallback.
13. Apply the same page/section rules to every "thingsToWatch" item, based on the clause(s) the observation is drawn from.

Field priority: the following fields are the most important to get right — contractOverview.parties, contractOverview.contractType, importantDates.startDate, importantDates.endDate, importantDates.renewalDate, importantDates.noticePeriod, importantDates.autoRenewal, commercialTerms.paymentTerms, commercialTerms.priceEscalation, keyClauses.termination, keyClauses.liabilityCap, keyClauses.governingLaw, and thingsToWatch. Still attempt every other field in the schema, using "Not found" where the contract doesn't say.

Contract text:
${pageMarkedText}`,
        },
        {
          role: "assistant",
          content: "{",
        },
      ],
    });

    // The save needs the fully-streamed, parsed analysis, which doesn't exist
    // yet at this point — this promise is resolved from inside the stream
    // below once the response is complete, and awaited from inside `after()`
    // so the save still runs as real background work (not a bare
    // fire-and-forget promise a serverless runtime could kill the instant
    // the response goes out) without delaying the stream's own completion.
    let resolveParsedAnalysis: (value: Record<string, unknown> | null) => void;
    const parsedAnalysisPromise = new Promise<Record<string, unknown> | null>((resolve) => {
      resolveParsedAnalysis = resolve;
    });
    const sessionId = getSessionId(req.headers);
    after(async () => {
      const parsedAnalysis = await parsedAnalysisPromise;
      if (!parsedAnalysis) {
        console.error("Skipped saving analysis: response was not valid JSON");
        return;
      }
      const saveStart = Date.now();
      const { error: saveError } = await supabase
        .from("analyses")
        .insert({ file_name: file.name, analysis: parsedAnalysis, session_id: sessionId });
      console.log(`[timing] Supabase save (background): ${Date.now() - saveStart}ms`);
      if (saveError) {
        console.error("Failed to save analysis to Supabase:", {
          message: saveError.message,
          code: saveError.code,
          details: saveError.details,
          hint: saveError.hint,
        });
      }
    });

    // Streams the analysis JSON back as plain text as Claude generates it —
    // the frontend reveals each Full Review zone as soon as its section
    // finishes streaming in, instead of waiting for the whole response. The
    // prefill char is written first since it isn't echoed back by the API
    // (same reasoning as the old non-streaming prefill comment: this makes
    // it structurally very hard for the model to reply in prose). The
    // contract text has no JSON envelope to travel in anymore, so it's
    // appended after a delimiter once the analysis stream itself is done.
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullText = "{";
        controller.enqueue(encoder.encode(fullText));
        try {
          anthropicStream.on("text", (delta) => {
            fullText += delta;
            controller.enqueue(encoder.encode(delta));
          });

          const message = await anthropicStream.finalMessage();
          console.log(`[timing] Claude API call (stream): ${Date.now() - claudeStart}ms`);

          if (message.stop_reason === "max_tokens") {
            // Distinguishes "model drifted into prose" from "response was cut
            // off mid-JSON" — both fail parseAnalysisJson below, but only
            // this one means max_tokens needs raising further rather than a
            // prompting fix.
            console.error(
              `Analysis for "${file.name}" was truncated at the max_tokens limit (${message.usage.output_tokens} output tokens).`
            );
          }

          controller.enqueue(encoder.encode(STREAM_CONTRACT_TEXT_DELIMITER + contractText));
          resolveParsedAnalysis(parseAnalysisJson(fullText));
          console.log(`[timing] TOTAL (stream complete): ${Date.now() - requestStart}ms`);
        } catch (error) {
          console.error("Analyze route error (mid-stream):", error);
          resolveParsedAnalysis(null);
          controller.error(error);
          return;
        }
        controller.close();
      },
    });

    return new Response(body, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Analyze route error:", error);
    return NextResponse.json(
      { error: "Failed to analyze document" },
      { status: 500 }
    );
  }
}