import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// `middleware.ts` is deprecated as of Next.js 16 in favor of `proxy.ts` —
// see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
// Same mechanism, renamed export.

const SESSION_COOKIE = "ci_session";
const SESSION_HEADER = "x-ci-session";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// This runs on every request and does two independent jobs.
//
// 1. Anonymous session id. Mints (or reads) a per-visitor id and makes it
//    available two ways: as an httpOnly response cookie, so the *browser*
//    carries it on future requests without exposing it to client-side JS, and
//    as a request header forwarded to the route handler for *this* request —
//    necessary because a brand-new cookie only reaches the browser via
//    Set-Cookie on the response; the request already in flight never sees it.
//    See lib/session.ts for the route-handler side of this.
//
// 2. Supabase Auth session refresh. Supabase access tokens are short-lived;
//    something has to spend the refresh token and write the new pair back as
//    cookies, and a route handler can't reliably do it (a Server Component
//    can't set cookies at all, and /api/analyze has already started streaming
//    by the time it would). Doing it here, once, before anything renders, is
//    the pattern @supabase/ssr is built around — without it you get random
//    logouts that are very hard to trace.
//
// Job 2 has to run first: refreshing the session can replace the response
// object entirely (see setAll below), which would throw away a Set-Cookie for
// ci_session written beforehand. So the ci_session cookie is attached to
// whatever response survives the refresh, at the end.
export async function proxy(request: NextRequest) {
  const existingSessionId = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = existingSessionId ?? crypto.randomUUID();

  // Rebuilt (not captured once) because setAll below mutates request.cookies,
  // and NextRequest keeps its `cookie` header in sync with that — a snapshot
  // taken before the refresh would forward the pre-refresh tokens onward.
  const requestHeadersNow = () => {
    const headers = new Headers(request.headers);
    headers.set(SESSION_HEADER, sessionId);
    return headers;
  };

  let response = NextResponse.next({ request: { headers: requestHeadersNow() } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          // Write refreshed tokens to the *request* as well as the response:
          // the request copy is what the route handler for this same request
          // reads, so without it a request that triggered a refresh would
          // still be processed as signed-out.
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeadersNow() } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // @supabase/ssr hands back the no-store headers that must accompany
          // any response carrying auth cookies — without them a CDN or proxy
          // in front of the app can cache one visitor's Set-Cookie and serve
          // that session to somebody else.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    });

    // Verifies the token's signature locally against the project's JWKS (this
    // project signs with ES256) and refreshes it through setAll above if it's
    // close to expiry. The return value is deliberately unused — route
    // handlers re-derive the user themselves via lib/supabase-server.ts;
    // this call exists purely for its refresh side effect.
    await supabase.auth.getClaims();
  }

  if (!existingSessionId) {
    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionId,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
