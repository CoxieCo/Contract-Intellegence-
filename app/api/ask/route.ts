import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const contractText = typeof body?.contractText === "string" ? body.contractText : "";
    const question = typeof body?.question === "string" ? body.question : "";

    if (!contractText.trim() || !question.trim()) {
      return NextResponse.json(
        { error: "Both contractText and question are required" },
        { status: 400 }
      );
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a contract analysis assistant answering a follow-up question about a specific contract. Answer ONLY using the contract text provided below — never invent information, and never rely on outside knowledge of what similar contracts usually say.

Rules — follow all of these exactly:
1. If the contract does not address the question, say so plainly (e.g. "The contract does not address this.") — do not guess or infer.
2. Quote or closely paraphrase the relevant contract language when possible.
3. Do not provide legal advice or legal conclusions of any kind — describe what the contract says, not what it means legally.
4. Keep the answer concise (a few sentences).
5. If you can identify the specific clause or section the answer comes from, set "sourceHint" to a short description of it (e.g. "Section 3, Termination") — only if it is actually identifiable in the text. Never fabricate a page or section reference that isn't evident in the text. If no source is identifiable, set "sourceHint" to an empty string.

Return ONLY valid JSON (no markdown, no code fences, no preamble) matching this exact shape:
{ "answer": "...", "sourceHint": "..." }

Contract text:
${contractText}

Question: ${question}`,
        },
      ],
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
