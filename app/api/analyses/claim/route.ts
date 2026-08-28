import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createUserClient, getAuthenticatedUserId } from "@/lib/supabase-server";
import { getSessionId } from "@/lib/session";

// Transfers scans made before signing up onto the new account.
//
// A visitor's first scan happens anonymously, owned only by the httpOnly
// `ci_session` cookie. Signing up mints a completely unrelated identity, so
// without this the work they just did would vanish from their new dashboard.
//
//   GET  -> how many unclaimed rows this session has, for the prompt
//   POST -> actually claim them
//
// Both are gated on a real authenticated session AND on the anonymous session
// cookie: the rows handed over are chosen by the httpOnly cookie the browser
// sends, never by an id in the request body, so there's nothing here a caller
// could point at somebody else's anonymous scans.

async function requireContext(req: NextRequest) {
  const supabase = await createUserClient();
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) } as const;
  }

  const sessionId = getSessionId(req.headers);
  if (!sessionId) {
    // No anonymous session cookie means there is nothing that could be
    // claimed — not an error, just an empty answer.
    return { error: NextResponse.json({ count: 0, claimed: 0 }) } as const;
  }

  return { userId, sessionId } as const;
}

export async function GET(req: NextRequest) {
  const ctx = await requireContext(req);
  if ("error" in ctx) return ctx.error;

  // Service-role: RLS grants the signed-in user no visibility into rows that
  // aren't theirs yet, which is precisely what's being counted here.
  const { count, error } = await supabaseAdmin
    .from("analyses")
    .select("id", { count: "exact", head: true })
    .eq("session_id", ctx.sessionId)
    .is("user_id", null);

  if (error) {
    console.error("Failed to count claimable analyses:", error);
    return NextResponse.json({ error: "Failed to check for previous scans" }, { status: 500 });
  }

  return NextResponse.json({ count: count ?? 0 });
}

export async function POST(req: NextRequest) {
  const ctx = await requireContext(req);
  if ("error" in ctx) return ctx.error;

  // Service-role for the write: migration 0003 deliberately grants
  // `authenticated` no UPDATE policy at all, so a browser client cannot
  // reassign user_id on any row. That means this transfer can only ever
  // happen here, behind the cookie check above.
  //
  // session_id is intentionally left as-is rather than cleared — it's still
  // the correct record of which browser session produced the scan, and the
  // (session_id, file_hash) unique index from migration 0002 depends on it
  // to keep de-duplicating re-scans of the same file.
  const { data, error } = await supabaseAdmin
    .from("analyses")
    .update({ user_id: ctx.userId })
    .eq("session_id", ctx.sessionId)
    .is("user_id", null)
    .select("id");

  if (error) {
    console.error("Failed to claim analyses:", error);
    return NextResponse.json({ error: "Failed to claim previous scans" }, { status: 500 });
  }

  return NextResponse.json({ claimed: data?.length ?? 0 });
}
