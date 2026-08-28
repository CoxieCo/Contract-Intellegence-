import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// The user-authenticated counterpart to lib/supabase.ts's `supabaseAdmin`.
// This one carries the anon key plus whatever Supabase Auth session is in the
// request's cookies, so every query it runs is subject to the RLS policies in
// supabase/migrations/0003_user_accounts_and_rls.sql. Reads of a signed-in
// user's own rows go through here specifically so that "you only see your own
// analyses" is enforced by Postgres rather than by a `.eq()` an application
// bug could drop.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// A fresh client per request — never a module-level singleton. The session
// lives in the client instance, so a shared one would leak one visitor's
// identity into another visitor's request on a warm serverless instance.
export async function createUserClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Writing cookies throws in a Server Component (and in a route
          // handler whose response has already started streaming, which
          // /api/analyze does). Swallowing it is safe here only because
          // proxy.ts refreshes the session on every request and writes the
          // refreshed tokens to the response itself — that, not this, is the
          // path that keeps a session alive.
        }
      },
    },
  });
}

// The authenticated user's id, or null if this request has no valid session.
//
// Uses getClaims() rather than getUser() or getSession():
//   * getSession() only decodes the cookie without verifying it, so a forged
//     cookie would be believed — never trust it server-side.
//   * getUser() is safe but costs a network round trip to the Auth server on
//     every single request.
//   * getClaims() verifies the JWT's signature locally against the project's
//     JWKS. This project signs with an asymmetric ES256 key (confirmed at
//     /auth/v1/.well-known/jwks.json), so verification really is local and
//     cached, with the same security property as getUser().
export async function getAuthenticatedUserId(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client.auth.getClaims();
  if (error) {
    // An expired or malformed token is a normal anonymous visitor, not an
    // outage — log it but treat the request as signed-out either way.
    console.error("Failed to verify auth claims:", error.message);
    return null;
  }
  return data?.claims?.sub ?? null;
}
