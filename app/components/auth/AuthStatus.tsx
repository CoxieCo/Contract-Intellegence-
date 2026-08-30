"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

// The nav's account control: shows the signed-in account's email plus a
// sign-out button when a real Supabase session exists, and a "Sign in" link
// otherwise. Used in every nav across the app (landing, dashboard, results,
// Ask, scan) so the auth state is visible and consistent everywhere, not just
// on one page.
//
// Colours are inline rather than via .text-muted / .btn-* utility classes,
// because those are scoped to .ci-results and this also renders inside
// .ci-landing.

const mutedStyle: React.CSSProperties = {
  fontSize: 13,
  color: "color-mix(in srgb, currentColor 60%, transparent)",
  maxWidth: 180,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export default function AuthStatus({ onSignedOut }: { onSignedOut?: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setEmail(data.user?.email ?? null);
      setReady(true);
    });

    // Keep the indicator live if the session changes in another tab or is
    // refreshed/expired while this page is open.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setEmail(session?.user?.email ?? null);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Briefly render nothing rather than flashing "Sign in" before the session
  // check resolves.
  if (!ready) return <span style={{ ...mutedStyle, opacity: 0 }}>…</span>;

  if (!email) {
    return (
      <Link href="/signin" className="btn btn-secondary">
        Sign in
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={mutedStyle} title={email}>
        {email}
      </span>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          setEmail(null);
          onSignedOut?.();
          router.refresh();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
