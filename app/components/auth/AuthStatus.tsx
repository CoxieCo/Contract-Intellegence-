"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

// PLACEHOLDER UI — see app/components/auth/SignInForm.tsx. Just enough of an
// account control to sign out and to tell at a glance which account a page is
// being viewed as, which the verification steps need.

export default function AuthStatus({ onSignedOut }: { onSignedOut: () => void }) {
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

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) return null;

  if (!email) {
    return (
      <Link href="/signin" className="btn btn-secondary">
        Sign in
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span className="text-muted" style={{ fontSize: 13 }}>{email}</span>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={async () => {
          const supabase = createClient();
          await supabase.auth.signOut();
          setEmail(null);
          // The list currently on screen is this account's; it has to be
          // re-read as the anonymous session, not left showing stale rows.
          onSignedOut();
          router.refresh();
        }}
      >
        Sign out
      </button>
    </div>
  );
}
