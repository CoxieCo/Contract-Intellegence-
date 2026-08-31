import Stripe from "stripe";

// Server-only Stripe helper.
//
// The Stripe client is created lazily, on first use, rather than at module
// load. If this module threw at import time on a missing STRIPE_SECRET_KEY,
// it would take `next build` down with it: Next evaluates the /api/checkout
// route module while collecting page data, so the throw aborts the whole
// build. On a host like Vercel a failed build means the *previous* deploy
// stays live — which is exactly the "my fix isn't showing up in production"
// trap. With lazy init, a missing key instead surfaces as a clean 500 from
// /api/checkout at request time (see the guard in the route handler).
//
// STRIPE_SECRET_KEY never carries the NEXT_PUBLIC_ prefix — every call site
// is a route handler, so it stays out of the browser bundle. The publishable
// key isn't needed here: this app redirects to Stripe's hosted Checkout page
// rather than mounting Stripe.js.
//
// No apiVersion is pinned — the SDK (v22) defaults to the API version it was
// built against, which is what we want until there's a reason to pin.

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  client = new Stripe(secretKey);
  return client;
}

// Whether the Stripe integration has the env it needs to run. Lets the route
// handler return a clean, explicit error instead of a stack trace.
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_PRICE_ID);
}

// The recurring Price the "Pro" tier subscribes the customer to. This is a
// `price_...` id (not the `prod_...` product id) — Checkout's subscription
// mode takes line items by price.
export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;

// ---------------------------------------------------------------------------
// TEMPORARY diagnostics — remove once the Vercel env-var issue is resolved.
//
// Describes the *runtime* state of each Stripe env var without ever emitting a
// secret value: presence, length, a leading/trailing-whitespace flag, and a
// non-sensitive prefix (`sk_live_`/`sk_test_`/`price_`/`prod_`…). Also reports
// which Vercel environment and build the running function came from, since the
// #1 cause of "the var is set but the function can't see it" is the var being
// scoped to the wrong environment (Preview vs Production) or the request
// hitting a deployment built before the var was added.
// ---------------------------------------------------------------------------

function describeVar(name: string, raw: string | undefined): Record<string, unknown> {
  if (raw === undefined) return { name, state: "MISSING (undefined)" };
  if (raw.length === 0) return { name, state: "EMPTY STRING" };

  const trimmed = raw.trim();
  const info: Record<string, unknown> = {
    name,
    state: "present",
    length: raw.length,
    whitespacePadded: trimmed.length !== raw.length,
  };

  if (name === "STRIPE_PRO_PRICE_ID") {
    info.prefix = trimmed.slice(0, trimmed.indexOf("_") + 1) || "(no underscore)";
    info.looksLikePrice = trimmed.startsWith("price_");
    info.looksLikeProduct = trimmed.startsWith("prod_");
  } else {
    const m = trimmed.match(/^(sk|pk|rk)_(live|test)_/);
    info.keyMode = m ? m[2] : "UNRECOGNIZED PREFIX";
    info.keyKind = m ? m[1] : trimmed.slice(0, 8);
  }
  return info;
}

export function describeStripeEnv() {
  return {
    isStripeConfigured: isStripeConfigured(),
    vars: [
      describeVar("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY),
      describeVar("STRIPE_PRO_PRICE_ID", process.env.STRIPE_PRO_PRICE_ID),
      describeVar("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    ],
    deployment: {
      VERCEL_ENV: process.env.VERCEL_ENV ?? "(not on Vercel)",
      VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      VERCEL_URL: process.env.VERCEL_URL ?? null,
    },
    // Names of every env var Vercel exposed to this function that mentions
    // "STRIPE" — catches typos like a trailing space or STRIPE_PRICE_ID.
    stripeVarNamesSeen: Object.keys(process.env).filter((k) => k.toUpperCase().includes("STRIPE")),
  };
}
