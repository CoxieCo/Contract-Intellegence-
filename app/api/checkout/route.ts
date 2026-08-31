import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured, STRIPE_PRO_PRICE_ID, describeStripeEnv } from "@/lib/stripe";
import { createUserClient, getAuthenticatedUser } from "@/lib/supabase-server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Step 3 of payments: create a real Stripe Checkout Session for the "Pro"
// subscription and hand its URL back for the browser to redirect to.
//
// This route deliberately does NOT touch the database. Nothing here marks
// anyone as Pro — completing the payment only produces a subscription over in
// Stripe. The webhook handler (next step) is what reads `client_reference_id`
// off the completed session and flips the account to Pro. If you change the
// join key below, change it there too.

// Returned to the frontend when the caller isn't signed in, so the pricing
// CTA can route through /signin and come back to /checkout rather than just
// failing. A machine-readable code, not a message match.
export const CHECKOUT_AUTH_REQUIRED_CODE = "AUTH_REQUIRED";

// The absolute origin to build success_url / cancel_url from. Stripe requires
// fully-qualified https (or http://localhost) URLs, and they must point at
// *this* deployment, not a hardcoded guess:
//   * NEXT_PUBLIC_SITE_URL wins when set (e.g. a canonical custom domain).
//   * Otherwise the request's own Origin header — correct in dev
//     (http://localhost:3000) and in every deployment, since this route is
//     only ever called by a same-origin fetch from the app itself.
//   * req.nextUrl.origin is the last resort if a client somehow omits Origin.
function resolveOrigin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  return req.headers.get("origin") ?? req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  // TEMPORARY: runs on every /api/checkout call. One line, no secret values —
  // just the runtime shape of each env var plus which Vercel deployment this
  // is. Remove once the env-var issue is resolved.
  console.log("[checkout-diagnostics]", JSON.stringify(describeStripeEnv()));

  if (!isStripeConfigured()) {
    console.error(
      "[checkout-diagnostics] isStripeConfigured() === false — STRIPE_SECRET_KEY and/or " +
        "STRIPE_PRO_PRICE_ID is not visible to this function at runtime (see the line above)"
    );
    return NextResponse.json(
      { error: "Checkout isn't configured yet. Please try again later." },
      { status: 500 }
    );
  }

  const allowed = await checkRateLimit(getClientIp(req.headers), "checkout");
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  // Must be signed in: the resulting subscription has to be attributable to a
  // real account for the webhook to have something to map it onto.
  const supabase = await createUserClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return NextResponse.json(
      {
        error: "Please sign in to start your subscription.",
        code: CHECKOUT_AUTH_REQUIRED_CODE,
      },
      { status: 401 }
    );
  }

  const origin = resolveOrigin(req);

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      // Non-null: isStripeConfigured() above already verified it is set.
      line_items: [{ price: STRIPE_PRO_PRICE_ID!, quantity: 1 }],

      // Prefill (and lock) the email to the one on the verified session, so
      // the Stripe customer and the Supabase account share an address.
      customer_email: user.email ?? undefined,

      // THE join key. The webhook (next step) reads this off the completed
      // session to know which Supabase account just subscribed. metadata
      // carries the same id in two more places for redundancy: on the session
      // and, via subscription_data, baked onto the Subscription object itself
      // so later subscription.* webhook events can be attributed without a
      // session lookup.
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },

      success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,

      allow_promotion_codes: true,
    });

    if (!session.url) {
      // Shouldn't happen for a hosted Checkout Session, but never redirect to
      // undefined.
      console.error("Stripe returned a Checkout Session with no URL", session.id);
      return NextResponse.json(
        { error: "Couldn't start checkout. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Failed to create Stripe Checkout Session:", err);
    return NextResponse.json(
      { error: "Couldn't start checkout. Please try again." },
      { status: 502 }
    );
  }
}
