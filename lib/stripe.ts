import Stripe from "stripe";

// Server-only Stripe client. STRIPE_SECRET_KEY is a test-mode key
// (sk_test_...) and must never carry the NEXT_PUBLIC_ prefix — every call
// site is a route handler, so it stays out of the browser bundle. The
// publishable key (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) is the browser-safe
// half and isn't needed here: this app redirects to Stripe's hosted
// Checkout page rather than mounting Stripe.js elements itself.
//
// No apiVersion is pinned — the SDK (v22) defaults to the API version it was
// built against, which is what we want until there's a reason to pin.

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

export const stripe = new Stripe(secretKey);

// The recurring Price the "Pro" tier subscribes the customer to. This is a
// `price_...` id (not the `prod_...` product id) — Checkout's subscription
// mode takes line items by price.
export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID;
