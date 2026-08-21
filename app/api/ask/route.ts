import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Generous enough for a genuinely long real contract, while rejecting the
// unbounded arbitrary-text case — nothing this route does depends on the
// text actually coming from an analyzed PDF, so without a cap it's a free
// text-completion proxy for anyone who finds the endpoint.
const MAX_CONTRACT_TEXT_LENGTH = 500_000;

function parseAskResponse(text: string): { answer: string; sourceHint: string } {
  let cleaned = text.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```[a-zA-Z]*\n/, "")
      .replace(/```$/, "")
      .trim();
  }

  try {
    const parsed = JSON.parse(cleaned) as { answer?: string; sourceHint?: string };
    if (typeof parsed.answer === "string") {
      return { answer: parsed.answer, sourceHint: parsed.sourceHint ?? "" };
    }
  } catch {
    // fall through to plain-text response
  }

  return { answer: text.trim(), sourceHint: "" };
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
2. Quote or closely paraphrase the relevant contract language when possible.
3. Do not provide legal advice or legal conclusions of any kind — describe what the contract says, not what it means legally.
4. Keep the answer concise (a few sentences).
5. If you can identify the specific clause or section the answer comes from, set "sourceHint" to a short description of it (e.g. "Section 3, Termination") — only if it is actually identifiable in the text. Never fabricate a page or section reference that isn't evident in the text. If no source is identifiable, set "sourceHint" to an empty string.
6. Earlier turns in this conversation, if present, are provided only so you can resolve references like "it" or "the other party" in the current question. They are never a source of contract facts — every fact in your answer must still come from the contract text below, following rules 1-2 exactly as if this were the first question asked.

Return ONLY valid JSON (no markdown, no code fences, no preamble) matching this exact shape:
{ "answer": "...", "sourceHint": "..." }

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

    const { answer, sourceHint } = parseAskResponse(responseText);

    return NextResponse.json({ success: true, answer, sourceHint });
  } catch (error) {
    console.error("Ask route error:", error);
    return NextResponse.json(
      { error: "Failed to get an answer" },
      { status: 500 }
    );
  }
}
