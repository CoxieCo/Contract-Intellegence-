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

function parseAskResponse(text: string): { answer: string; sourceHint: string; section: AskSection | null } {
  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```[a-zA-Z]*\n/, "")
      .replace(/```$/, "")
      .trim();
  }

  try {
    const parsed = JSON.parse(cleaned) as { answer?: string; sourceHint?: string; section?: string };
    if (typeof parsed.answer === "string") {
      const section = ASK_SECTIONS.find((s) => s === parsed.section) ?? null;
      return { answer: parsed.answer, sourceHint: parsed.sourceHint ?? "", section };
    }
  } catch {
    // fall through to plain-text response
  }

  return { answer: text.trim(), sourceHint: "", section: null };
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
1. If the contract does not address the question, say so plainly (e.g. "The contract does not address this.") — do not guess or infer.
2. Quote the contract's exact wording whenever the answer rests on a specific clause — do not paraphrase language the user is relying on verbatim. Paraphrase only when summarizing across multiple scattered provisions that can't be quoted as one passage.
3. Do not provide legal advice or legal conclusions of any kind — describe what the contract says, not what it means legally.
4. Keep your own framing brief — at most one short lead-in sentence — but quote a clause in full rather than trimming it if trimming would change its meaning. If the answer includes more than one quoted passage, or a clause with multiple distinct parts, separate them with a blank line (a "\n\n" in the JSON string) instead of running them together, so a longer or multi-part answer stays readable instead of becoming one dense block.
5. If you can identify the specific clause or section the answer comes from, set "sourceHint" to a short description of it (e.g. "Section 3, Termination") — only if it is actually identifiable in the text. Never fabricate a page or section reference that isn't evident in the text. If no source is identifiable, set "sourceHint" to an empty string.
6. Earlier turns in this conversation, if present, are provided only so you can resolve references like "it" or "the other party" in the current question. They are never a source of contract facts — every fact in your answer must still come from the contract text below, following rules 1-2 exactly as if this were the first question asked.
7. Set "section" to whichever ONE of these categories the question/answer is primarily about, using the literal id: "overview" (contract identity — parties, contract type, purpose, status), "dates" (start/end/renewal dates, notice periods/deadlines, auto-renewal), "terms" (contract value, payment terms, pricing, price escalation, minimum commitments), "clauses" (termination, liability, governing law, assignment, confidentiality, SLA), "watch" (risk/what to watch out for), or "unknown" (asking what's missing/not found in the contract). If none clearly fits, set "section" to null.

Return ONLY valid JSON (no markdown, no code fences, no preamble) matching this exact shape:
{ "answer": "...", "sourceHint": "...", "section": "overview" | "dates" | "terms" | "clauses" | "watch" | "unknown" | null }

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

    const { answer, sourceHint, section } = parseAskResponse(responseText);

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

    return NextResponse.json({ success: true, answer, sourceHint, section });
  } catch (error) {
    console.error("Ask route error:", error);
    return NextResponse.json(
      { error: "Failed to get an answer" },
      { status: 500 }
    );
  }
}
