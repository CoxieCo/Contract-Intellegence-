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
// STRIPE_SECRET_KEY is a test-mode key (sk_test_...) and never carries the
// NEXT_PUBLIC_ prefix — every call site is a route handler, so it stays out
// of the browser bundle. The publishable key isn't needed here: this app
// redirects to Stripe's hosted Checkout page rather than mounting Stripe.js.
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
