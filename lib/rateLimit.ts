import { supabase } from "./supabase";

// Best-effort IP-based throttle backed by the same Supabase project already
// used for persistence, rather than pulling in a separate rate-limiting
// service for a single-app deployment. Not bulletproof — shared IPs and
// VPNs mean it can both over- and under-block — but it's a real deterrent
// against casual abuse while there's no auth system to key limits off of
// instead.

interface RateLimitRule {
  windowMinutes: number;
  maxRequests: number;
}

const RULES = {
  analyze: { windowMinutes: 10, maxRequests: 10 },
  ask: { windowMinutes: 10, maxRequests: 30 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitedEndpoint = keyof typeof RULES;

// Vercel's edge proxy sets these on every request that reaches a serverless
// function; NextRequest itself has no `.ip`/`.geo` in this Next.js version
// (removed from the App Router request object), so the client IP has to be
// read from headers directly. x-forwarded-for can carry a chain of proxies
// (client, then any intermediates) — the first entry is the original client.
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp;
  // Local dev / any deployment without a forwarding proxy in front — every
  // such caller shares one bucket, which is fine outside of production.
  return "unknown";
}

// Bounds how long a single Supabase call can block the request. Before the
// rate_limits table existed, every call failed instantly (schema-not-found)
// and the fail-open path below always fired fast; now that the table is
// real, a slow/stalled connection to Supabase has nothing else bounding it —
// the underlying fetch has no default timeout, so it can hang well past any
// reasonable request duration. This turns that hang into the same fail-open
// outcome as any other Supabase error.
const SUPABASE_TIMEOUT_MS = 5000;
const TIMEOUT = Symbol("rate-limit-timeout");

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | typeof TIMEOUT> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), ms)),
  ]);
}

// Returns true if the request is allowed to proceed. Logs the attempt first
// (so a burst of rejected retries still counts toward the window instead of
// resetting it), then counts recent attempts from the same IP+endpoint.
// Fails open on any Supabase error, or if a call doesn't finish within
// SUPABASE_TIMEOUT_MS — a rate-limit outage or stall shouldn't take the
// product down, only the abuse deterrent.
export async function checkRateLimit(ip: string, endpoint: RateLimitedEndpoint): Promise<boolean> {
  const rule = RULES[endpoint];
  const windowStart = new Date(Date.now() - rule.windowMinutes * 60_000).toISOString();

  const insertResult = await withTimeout(
    supabase.from("rate_limits").insert({ ip_address: ip, endpoint }),
    SUPABASE_TIMEOUT_MS
  );
  if (insertResult === TIMEOUT) {
    console.error(`Rate limit insert timed out for ${endpoint}`);
    return true;
  }
  if (insertResult.error) {
    console.error(`Rate limit insert failed for ${endpoint}:`, insertResult.error.message);
    return true;
  }

  const countResult = await withTimeout(
    supabase
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .eq("endpoint", endpoint)
      .gte("created_at", windowStart),
    SUPABASE_TIMEOUT_MS
  );
  if (countResult === TIMEOUT) {
    console.error(`Rate limit count timed out for ${endpoint}`);
    return true;
  }
  const { count, error: countError } = countResult;
  if (countError) {
    console.error(`Rate limit count failed for ${endpoint}:`, countError.message);
    return true;
  }

  // Cheap, probabilistic sweep so the table doesn't grow unbounded — no cron
  // job needed for a table this low-volume. Best-effort; failure here
  // doesn't affect the rate-limit decision above.
  if (Math.random() < 0.05) {
    void supabase
      .from("rate_limits")
      .delete()
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  }

  return (count ?? 0) <= rule.maxRequests;
}
