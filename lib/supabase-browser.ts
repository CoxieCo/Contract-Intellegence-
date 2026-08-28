import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client, used only for the auth handshake itself
// (sign up, sign in, sign out, OAuth redirect). It holds the anon key, which
// is safe to ship: the RLS policies in
// supabase/migrations/0003_user_accounts_and_rls.sql are what decide what it
// can actually read, and no policy grants it any write at all.
//
// It deliberately does NOT read `analyses` directly. Data still comes from
// the app's own API routes, so the anonymous (user_id IS NULL) path — which
// RLS cannot express, because it's scoped by an httpOnly cookie the browser
// can't read — stays on one code path with the signed-in one.
//
// @supabase/ssr persists the session in cookies rather than localStorage,
// which is the whole point: proxy.ts and the route handlers can only see the
// session if the browser sends it on every request.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function createClient() {
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}
