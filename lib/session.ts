// Anonymous session id — not a real login, just enough to stop one
// visitor's dashboard from showing another visitor's contracts. Minted and
// attached by proxy.ts.
//
// Route handlers read it from this request header rather than the
// `ci_session` cookie directly: on a visitor's very first request, proxy.ts
// mints a new id and puts it on the *response* cookie (via Set-Cookie) —
// the browser won't send that cookie back until its *next* request, so the
// incoming request object here still has no cookie. proxy.ts forwards the
// same id via this header on every request (new or existing) specifically
// so that first request is scoped correctly too, not just subsequent ones.
const SESSION_HEADER = "x-ci-session";

export function getSessionId(headers: Headers): string | null {
  return headers.get(SESSION_HEADER);
}
