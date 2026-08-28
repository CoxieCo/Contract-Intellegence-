import { createClient } from "@supabase/supabase-js";

// The service-role client: it bypasses RLS entirely, so it is deliberately
// named `supabaseAdmin` rather than a bare `supabase`. There is now a second,
// user-authenticated client (lib/supabase-server.ts) whose whole purpose is
// to be constrained by the RLS policies in
// supabase/migrations/0003_user_accounts_and_rls.sql — reaching for the wrong
// one of the two is a data-leak bug, not a style question, so neither is
// allowed to have the generic name.
//
// Use this one only where elevated access is genuinely required:
//   * lib/rateLimit.ts        — the rate_limits table has no policies at all
//   * /api/analyze            — writing the analysis row during processing
//   * /api/analyses (anon)    — reading anonymous rows scoped by session cookie
//   * /api/analyses/claim     — reassigning user_id, which no RLS policy allows
//
// Every call site is a server-only route handler, never a client component,
// so this key is never in the browser bundle (no NEXT_PUBLIC_ prefix).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  // Nothing on this client is ever a logged-in user, and a serverless
  // instance shouldn't try to persist or refresh a session between requests.
  auth: { persistSession: false, autoRefreshToken: false },
});
