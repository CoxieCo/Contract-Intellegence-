"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import "../components/results/results.css";
import AuthStatus from "../components/auth/AuthStatus";

// The bridge between the pricing page's "Start Scanning" CTA and Stripe's
// hosted Checkout page. It has no UI of its own beyond a status line: on
// mount it asks /api/checkout for a Checkout Session and sends the browser
// there.
//
// Why a dedicated page rather than firing the fetch straight from the button:
// if the visitor isn't signed in, /api/checkout answers 401 and this page
// redirects to /signin?next=/checkout. After signing in, /auth/callback (and
// the password flow) return the visitor right back here, and this effect runs
// again — now authenticated — and checkout proceeds. The button itself stays
// a dumb router.push("/checkout").

const CHECKOUT_PATH = "/checkout";

interface CheckoutResult {
  status: number;
  data: { url?: string; error?: string; code?: string };
}

async function createCheckoutSession(): Promise<CheckoutResult> {
  const res = await fetch("/api/checkout", { method: "POST" });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export default function CheckoutPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  // The in-flight (or already-settled) request for the current attempt, held
  // in a ref that survives React 18 StrictMode's dev-only
  // mount → unmount → remount. Without this, either two Checkout Sessions get
  // created, or (the bug this replaces) a "skip if already started" guard
  // makes the remount return early and the page sits on the loading state
  // forever because nothing ever handles the response.
  const pending = useRef<Promise<CheckoutResult> | null>(null);
  const pendingForAttempt = useRef(-1);

  useEffect(() => {
    if (pendingForAttempt.current !== attempt) {
      pendingForAttempt.current = attempt;
      pending.current = createCheckoutSession();
    }

    let cancelled = false;

    pending.current
      ?.then(({ status, data }) => {
        if (cancelled) return;

        if (status === 401 && data.code === "AUTH_REQUIRED") {
          // Sign in, then land back here to retry automatically.
          router.replace(`/signin?next=${encodeURIComponent(CHECKOUT_PATH)}`);
          return;
        }

        if (status < 200 || status >= 300 || !data.url) {
          setError(data.error || "Couldn't start checkout. Please try again.");
          return;
        }

        // Stripe-hosted page — a full navigation, not a client route.
        window.location.href = data.url;
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't reach checkout. Check your connection and try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, router]);

  const retry = () => {
    setError("");
    // Force the next effect run to start a fresh request rather than re-await
    // the failed one.
    pendingForAttempt.current = -1;
    setAttempt((n) => n + 1);
  };

  return (
    <div
      className="ci-results"
      style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", display: "flex", flexDirection: "column" }}
    >
      <nav className="nav" style={{ borderBottom: "1px solid var(--color-divider)", flex: "none" }}>
        <Link href="/" className="nav-brand" style={{ color: "var(--color-text)" }}>
          Contract Intelligence
        </Link>
        <AuthStatus />
      </nav>
      <main style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", padding: "48px 24px" }}>
        <div className="card blueprint" style={{ width: "100%", maxWidth: 400, padding: 28, textAlign: "center" }}>
          <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
          {error ? (
            <>
              <p style={{ fontWeight: 600, fontSize: 16 }}>Checkout didn&rsquo;t start</p>
              <p className="text-muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>{error}</p>
              <div style={{ marginTop: 18, display: "flex", gap: 10, justifyContent: "center" }}>
                <button type="button" className="btn btn-primary" onClick={retry}>
                  Try again
                </button>
                <Link href="/#pricing" className="btn btn-secondary">
                  Back to pricing
                </Link>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 600, fontSize: 16 }}>Taking you to secure checkout…</p>
              <p className="text-muted" style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5 }}>
                Payments are handled by Stripe. You&rsquo;ll be redirected in a moment.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
