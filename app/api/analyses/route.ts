import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createUserClient, getAuthenticatedUserId } from "@/lib/supabase-server";
import { getSessionId } from "@/lib/session";

// contract_text rides along with every row in this list (not just whichever
// one gets opened) so the dashboard can hand it to Ask Your Contract the
// moment a past analysis is reopened, with no second round trip — the same
// trade-off the already-included `analysis` blob makes. Worth revisiting if
// this list ever needs to be lean (a separate detail endpoint), but there's
// no sign of that being a real cost yet.
const COLUMNS = "id, created_at, file_name, analysis, contract_text";
const LIMIT = 10;

// Two distinct ownership models read through two distinct clients.
export async function GET(req: NextRequest) {
  const supabase = await createUserClient();
  const userId = await getAuthenticatedUserId(supabase);

  if (userId) {
    // Signed in: read through the *user* client, which carries the visitor's
    // JWT and is therefore constrained by the "Users can read their own
    // analyses" policy from
    // supabase/migrations/0003_user_accounts_and_rls.sql.
    //
    // There is deliberately no `.eq("user_id", userId)` here. The whole point
    // of moving this read off the service-role key is that Postgres enforces
    // the scoping; a redundant application-side filter would keep this
    // endpoint looking correct even if the policy were dropped, which is
    // exactly the regression worth failing loudly on.
    const { data, error } = await supabase
      .from("analyses")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(LIMIT);

    if (error) {
      console.error("Failed to fetch analyses for user:", error);
      return NextResponse.json({ error: "Failed to load analyses" }, { status: 500 });
    }

    return NextResponse.json({ analyses: data, signedIn: true });
  }

  // Anonymous: RLS can't express "rows belonging to the httpOnly cookie this
  // request carries" — the browser can't read that cookie, so there's no JWT
  // claim for a policy to match on. This path stays on the service-role key
  // with the scoping done here, exactly as before accounts existed.
  const sessionId = getSessionId(req.headers);

  // No session id means proxy.ts didn't run for this request (shouldn't
  // happen under normal routing) — fail closed rather than falling back to
  // the old "everyone's analyses" behavior this scoping exists to remove.
  if (!sessionId) {
    return NextResponse.json({ analyses: [], signedIn: false });
  }

  const { data, error } = await supabaseAdmin
    .from("analyses")
    .select(COLUMNS)
    .eq("session_id", sessionId)
    // Claiming a row sets user_id but deliberately keeps session_id, so the
    // old anonymous cookie still matches it. Without this guard, signing out
    // (or a shared browser) would resurface rows that now belong to an
    // account through the anonymous path.
    .is("user_id", null)
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  if (error) {
    console.error("Failed to fetch analyses from Supabase:", error);
    return NextResponse.json({ error: "Failed to load analyses" }, { status: 500 });
  }

  return NextResponse.json({ analyses: data, signedIn: false });
}
