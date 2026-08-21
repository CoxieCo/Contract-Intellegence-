import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// `middleware.ts` is deprecated as of Next.js 16 in favor of `proxy.ts` —
// see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
// Same mechanism, renamed export.

const SESSION_COOKIE = "ci_session";
const SESSION_HEADER = "x-ci-session";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

// Mints (or reads) an anonymous per-visitor session id and makes it
// available two ways: as an httpOnly response cookie, so the *browser*
// carries it on future requests without exposing it to client-side JS, and
// as a request header forwarded to the route handler for *this* request —
// necessary because a brand-new cookie only reaches the browser via
// Set-Cookie on the response; the request already in flight never sees it.
// See lib/session.ts for the route-handler side of this.
export function proxy(request: NextRequest) {
  const existing = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = existing ?? crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(SESSION_HEADER, sessionId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!existing) {
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
