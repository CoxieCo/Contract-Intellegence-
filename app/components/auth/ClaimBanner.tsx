"use client";

import { useEffect, useState } from "react";

// PLACEHOLDER UI — see app/components/auth/SignInForm.tsx.
//
// The scans a visitor ran before signing up belong to their anonymous
// `ci_session` cookie, not to the account they just created. This asks
// whether to move them over. It's an explicit prompt rather than an automatic
// transfer because a shared or borrowed browser would otherwise hand one
// person's contracts to whoever signs in next.

// Dismissal used to live only in `dismissed` component state, which resets
// on every mount — "Not now" didn't actually mean anything past the current
// page, so the same N-scans prompt came back on every dashboard visit for as
// long as those rows stayed unclaimed. Persisting the *count that was
// dismissed* (not just a bare yes/no flag) keeps this self-healing: if the
// visitor scans again anonymously later and comes back with a genuinely
// different count to claim, that's worth surfacing again, not suppressed
// forever by one old dismissal.
const DISMISSED_COUNT_KEY = "ci_claim_dismissed_count";

export default function ClaimBanner({ onClaimed }: { onClaimed: () => void }) {
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/analyses/claim");
        // 401 just means signed out — nothing to offer, and not an error
        // worth showing.
        if (!res.ok) return;
        const data = await res.json();
        const fetchedCount = typeof data.count === "number" ? data.count : 0;
        if (cancelled) return;

        setCount(fetchedCount);

        let dismissedCount = -1;
        try {
          const stored = localStorage.getItem(DISMISSED_COUNT_KEY);
          if (stored !== null) dismissedCount = Number(stored);
        } catch {
          // Private browsing / storage disabled — falls back to showing the
          // banner every load, same as before this fix, rather than crashing.
        }
        if (fetchedCount > 0 && fetchedCount === dismissedCount) setDismissed(true);
      } catch {
        // Offering the claim is best-effort; the rows stay claimable and the
        // prompt reappears on the next load.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (count === 0 || dismissed) return null;

  async function claim() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/analyses/claim", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't claim those scans.");
        setBusy(false);
        return;
      }
      setCount(0);
      // The dashboard's own list was fetched before these rows had an owner,
      // so it has to re-read to show them.
      onClaimed();
    } catch {
      setError("Couldn't reach the server. Try again.");
      setBusy(false);
    }
  }

  return (
    <div
      className="card blueprint"
      style={{ padding: "14px 16px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}
    >
      <p style={{ flex: 1, minWidth: 240, fontSize: 14 }}>
        You have {count} previous scan{count === 1 ? "" : "s"} from before signing up — claim {count === 1 ? "it" : "them"}?
      </p>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: "var(--color-danger)" }}>
          {error}
        </span>
      )}
      <button type="button" className="btn btn-primary" onClick={claim} disabled={busy}>
        {busy ? "Claiming…" : "Claim"}
      </button>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          try {
            localStorage.setItem(DISMISSED_COUNT_KEY, String(count));
          } catch {
            // Nothing to persist to — this load stops nagging via `dismissed`
            // below regardless, it just won't stay dismissed on the next one.
          }
          setDismissed(true);
        }}
        disabled={busy}
      >
        Not now
      </button>
    </div>
  );
}
