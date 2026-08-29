import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabase";
import { createUserClient, getAuthenticatedUserId } from "@/lib/supabase-server";
import { getSessionId } from "@/lib/session";
import { SIGNUP_REQUIRED_CODE } from "@/lib/freeTier";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// How many questions an anonymous visitor may ask about their one free demo
// scan before Ask, like a second scan, asks them to sign up. The whole point
// of the free scan is to show what makes the product worth paying for —
// hiding Ask behind the same wall meant to convert people defeats that, so
// this caps the cost instead of blocking it outright. Signed-in users have
// no cap here at all.
const FREE_ANONYMOUS_ASK_QUESTIONS = 3;

// Current count for an anonymous session, or 0 on any read failure — fails
// open the same way lib/rateLimit.ts does, so a Supabase hiccup costs a free
// question rather than breaking Ask outright.
async function getAnonymousAskCount(sessionId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("ask_usage")
    .select("question_count")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("Failed to read ask usage, treating as zero:", error.message);
    return 0;
  }
  return data?.question_count ?? 0;
}

// Generous enough for a genuinely long real contract, while rejecting the
// unbounded arbitrary-text case — nothing this route does depends on the
// text actually coming from an analyzed PDF, so without a cap it's a free
// text-completion proxy for anyone who finds the endpoint.
const MAX_CONTRACT_TEXT_LENGTH = 500_000;

// Mirrors ResultSectionId in app/components/results/ResultsView.tsx — the
// section the Ask Your Contract page can jump back to when a citation chip
// on this answer is clicked. Kept as a plain string union here (this route
// has no reason to import a client component's type) rather than a shared
// export, since the two are already independently the source of truth for
// their own side (the prompt below vs. the sidebar/section ids).
const ASK_SECTIONS = ["overview", "dates", "terms", "clauses", "watch", "unknown"] as const;
type AskSection = (typeof ASK_SECTIONS)[number];

// One verbatim-quoted clause backing part of the answer, with its own real
// citation — same shape as SourcedValue elsewhere in this app (page/section
// pinned to wherever the quote actually appears), so a citation under an Ask
// answer can open PdfViewer exactly like a Field Card's or a Things to
// Watch item's citation does. topic is a short (1-3 word) label naming what
// the clause is about, used to build the "This touches X, Y, and Z" preview
// for a multi-passage answer — see app/components/ask/AskContractView.tsx.
export interface AskPassage {
  topic: string;
  quote: string;
  page: number | null;
  section: string | null;
}

type RawAskResponse = { intro?: string; passages?: unknown; section?: string };

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```[a-zA-Z]*\n/, "")
    .replace(/```$/, "")
    .trim();
}

// A malformed passage entry (missing/blank quote) is dropped rather than
// rendered — a citation with no clause behind it isn't useful, and a
// missing page/section is a legitimate "couldn't confidently place this"
// answer (see the prompt's rule 8), not a parse failure.
function parsePassage(raw: unknown): AskPassage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.quote !== "string" || !r.quote.trim()) return null;
  return {
    topic: typeof r.topic === "string" ? r.topic : "",
    quote: r.quote,
    page: typeof r.page === "number" && Number.isFinite(r.page) ? r.page : null,
    section: typeof r.section === "string" ? r.section : null,
  };
}

function parseAskResponse(text: string): { intro: string; passages: AskPassage[]; section: AskSection | null } {
  try {
    let parsed = JSON.parse(stripCodeFence(text)) as RawAskResponse;
    if (typeof parsed.intro === "string" || Array.isArray(parsed.passages)) {
      // Occasionally (observed live with an earlier version of this schema,
      // and plausible again here) the model nests the entire structured
      // response a second time inside its own "intro" string — e.g.
      // intro: "```json\n{ \"intro\": ..., \"passages\": [...] }\n```" —
      // instead of returning those fields at the top level as asked. If the
      // intro text itself looks like a fenced or raw JSON object carrying
      // this same shape, unwrap it and use its fields instead of the outer
      // shell, rather than showing the user a literal blob of nested JSON.
      const innerCandidate = stripCodeFence(typeof parsed.intro === "string" ? parsed.intro : "");
      if (innerCandidate.startsWith("{") && innerCandidate.includes('"passages"')) {
        try {
          const inner = JSON.parse(innerCandidate) as RawAskResponse;
          if (typeof inner.intro === "string" || Array.isArray(inner.passages)) parsed = inner;
        } catch {
          // Not actually nested JSON — just intro text that happens to
          // start with a brace. Fall through and use the outer shell as-is.
        }
      }

      const section = ASK_SECTIONS.find((s) => s === parsed.section) ?? null;
      const passages = Array.isArray(parsed.passages)
        ? parsed.passages.map(parsePassage).filter((p): p is AskPassage => p !== null)
        : [];
      return { intro: typeof parsed.intro === "string" ? parsed.intro : "", passages, section };
    }
  } catch {
    // fall through to plain-text response
  }

  return { intro: text.trim(), passages: [], section: null };
}

interface HistoryTurn {
  question: string;
  answer: string;
}

function parseHistory(value: unknown): HistoryTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (turn): turn is HistoryTurn =>
        !!turn &&
        typeof turn === "object" &&
        typeof (turn as Record<string, unknown>).question === "string" &&
        typeof (turn as Record<string, unknown>).answer === "string"
    )
    // Only the last few turns are needed to resolve pronouns/references —
    // and it keeps every request bounded regardless of how long the
    // conversation in the UI has grown.
    .slice(-3);
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const allowed = await checkRateLimit(ip, "ask");
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many questions. Please wait a few minutes and try again." },
        { status: 429 }
      );
    }

    // Resolved before the request body is touched, mirroring /api/analyze —
    // a visitor who's already used their free questions shouldn't pay for a
    // Claude call the gate below is about to refuse anyway.
    const supabaseUser = await createUserClient();
    const userId = await getAuthenticatedUserId(supabaseUser);
    const sessionId = getSessionId(req.headers);

    // Only ever consulted for anonymous callers — a signed-in user has no
    // cap here, and the count is read once and reused for the increment
    // below rather than re-read, so this stays a single round trip either way.
    let anonymousAskCount = 0;
    if (!userId && sessionId) {
      anonymousAskCount = await getAnonymousAskCount(sessionId);
      if (anonymousAskCount >= FREE_ANONYMOUS_ASK_QUESTIONS) {
        return NextResponse.json(
          {
            error:
              "You've used your free questions for this contract. Sign up for a free account to keep asking — your scan comes with you.",
            code: SIGNUP_REQUIRED_CODE,
          },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const contractText = typeof body?.contractText === "string" ? body.contractText : "";
    const question = typeof body?.question === "string" ? body.question : "";
    const history = parseHistory(body?.history);

    if (!contractText.trim() || !question.trim()) {
      return NextResponse.json(
        { error: "Both contractText and question are required" },
        { status: 400 }
      );
    }

    if (contractText.length > MAX_CONTRACT_TEXT_LENGTH) {
      return NextResponse.json(
        { error: "This contract is too long to ask questions about." },
        { status: 413 }
      );
    }

    const systemPrompt = `You are a contract analysis assistant answering questions about a specific contract. Answer ONLY using the contract text provided below — never invent information, and never rely on outside knowledge of what similar contracts usually say.

Rules — follow all of these exactly:
1. If the contract does not address the question, say so plainly in "intro" (e.g. "The contract does not address this.") and set "passages" to an empty array — do not guess or infer.
2. Every specific claim about what the contract says or requires must be backed by an exact quote of the clause it comes from — never paraphrase clause language into your own words. This applies just as much to a broad or analytical question (e.g. "what should I negotiate before signing", "what's risky here") as to a direct lookup: if answering it means drawing on several clauses, add one passage per clause rather than summarizing what they say — "intro" is for brief framing only, never for restating a clause's content.
3. Do not provide legal advice or legal conclusions of any kind — describe what the contract says, not what it means legally.
4. Keep "intro" to at most one short lead-in sentence, or an empty string if the quoted passage(s) need no introduction. Each passage's "quote" must be the clause in full and verbatim — never trimmed if trimming would change its meaning, never edited, never merged with another clause.
5. Set each passage's "topic" to 1-3 words naming just its subject (e.g. "pricing", "liability cap", "termination rights") — what the clause is about, never what it says. A topic label isn't itself a claim about the contract, so it's exempt from rule 2's quoting requirement, but it must not characterize or editorialize either.
6. The contract text below is divided into pages marked with "--- PAGE N ---" headers. For each passage, set "page" to the exact page number (matching one of those markers) where that quote actually appears. If the same clause is repeated on more than one page, cite the page with its clearest/primary statement.
7. Set each passage's "section" to the clause or section label EXACTLY as printed in the text (e.g. "Section 7.3", "Clause 13.2") only if the text explicitly labels it that way. Never invent, number, or guess a section label that isn't printed in the source text — if none is printed, use null.
8. Set a passage's "page" and "section" to the literal JSON value null (never 0, never a guess, never a default to page 1) whenever you cannot confidently identify the specific page a quote came from.
9. Earlier turns in this conversation, if present, are provided only so you can resolve references like "it" or "the other party" in the current question. They are never a source of contract facts — every fact in your answer must still come from the contract text below, following rules 1-2 exactly as if this were the first question asked.
10. Set the top-level "section" to whichever ONE of these categories the question/answer is primarily about, using the literal id: "overview" (contract identity — parties, contract type, purpose, status), "dates" (start/end/renewal dates, notice periods/deadlines, auto-renewal), "terms" (contract value, payment terms, pricing, price escalation, minimum commitments), "clauses" (termination, liability, governing law, assignment, confidentiality, SLA), "watch" (risk/what to watch out for), or "unknown" (asking what's missing/not found in the contract). If none clearly fits, set it to null.

Return ONLY valid JSON (no markdown, no code fences, no preamble) matching this exact shape, and this shape only — "intro" is prose text, never another JSON object, code fence, or copy of this same structure:
{ "intro": "...", "passages": [ { "topic": "...", "quote": "...", "page": <number|null>, "section": "..."|null } ], "section": "overview" | "dates" | "terms" | "clauses" | "watch" | "unknown" | null }

Contract text:
${contractText}`;

    const messages: Anthropic.MessageParam[] = [
      ...history.flatMap((turn): Anthropic.MessageParam[] => [
        { role: "user", content: turn.question },
        { role: "assistant", content: turn.answer },
      ]),
      { role: "user", content: question },
    ];

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    const { intro, passages, section } = parseAskResponse(responseText);

    // Counted here, not before the Claude call — an anonymous visitor's free
    // questions are spent on answers they actually got, not on attempts that
    // errored out. Best-effort: a SELECT-then-write rather than an atomic
    // increment (no RPC exists for this one-column table), so a lost race
    // between two concurrent requests from the same session could let at
    // most one extra question through — an acceptable trade-off for a soft
    // cost cap, same reasoning as lib/rateLimit.ts's own fail-open stance.
    if (!userId && sessionId) {
      const { error: usageError } = await supabaseAdmin
        .from("ask_usage")
        .upsert({ session_id: sessionId, question_count: anonymousAskCount + 1, updated_at: new Date().toISOString() });
      if (usageError) console.error("Failed to record ask usage:", usageError.message);
    }

    return NextResponse.json({ success: true, intro, passages, section });
  } catch (error) {
    console.error("Ask route error:", error);
    return NextResponse.json(
      { error: "Failed to get an answer" },
      { status: 500 }
    );
  }
}
