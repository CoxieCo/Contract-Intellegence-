"use client";

// The "set a new password" step of the password-recovery flow. By the time
// this renders, /auth/callback has already verified the emailed recovery
// token and written the session cookies (or, in the implicit-flow case, the
// browser client parses the URL hash on load) — so a valid session here IS
// the recovery session. We call updateUser({ password }) against it, then
// sign it out so the user finishes on a real sign-in with the new password.
//
// Plain styling to match the placeholder SignInForm — same .ci-results
// tokens, no design treatment yet.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

type Status = "checking" | "ready" | "no-session" | "saving" | "done";

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // The session can be present two ways: written to cookies by
    // /auth/callback before this page rendered (the path this project's email
    // links take), or parsed from a `#access_token=…&type=recovery` hash by
    // the browser client on load, which fires PASSWORD_RECOVERY.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setStatus((current) => (current === "checking" ? (data.session ? "ready" : "no-session") : current));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        setStatus((current) => (current === "saving" || current === "done" ? current : "ready"));
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setStatus("ready");
      return;
    }

    // End the recovery session so the next step is a genuine sign-in with the
    // new password — confirms it works and leaves a clean session state.
    await supabase.auth.signOut();
    setStatus("done");
    router.replace(
      "/signin?notice=" + encodeURIComponent("Your password has been updated. Sign in with your new password.")
    );
    router.refresh();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "9px 11px",
    border: "1px solid var(--color-divider)",
    background: "transparent",
    color: "var(--color-text)",
    fontSize: 14,
  };

  return (
    <div className="card blueprint" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Set a new password</h1>
        <p className="text-muted" style={{ marginTop: 4, fontSize: 14 }}>
          Placeholder screen — the designed version comes later.
        </p>
      </div>

      {status === "checking" && (
        <p role="status" className="text-muted" style={{ fontSize: 14 }}>
          Checking your reset link…
        </p>
      )}

      {status === "no-session" && (
        <>
          <p role="alert" style={{ fontSize: 14, color: "var(--color-danger)", fontWeight: 500 }}>
            This reset link is missing, invalid, or has expired.
          </p>
          <p className="text-muted" style={{ fontSize: 14 }}>
            Password reset links can only be opened once and time out after a while. Head back to sign-in and choose
            &ldquo;Forgot your password?&rdquo; to get a fresh one.
          </p>
          <Link href="/signin" className="btn btn-primary" style={{ textAlign: "center" }}>
            Back to sign-in
          </Link>
        </>
      )}

      {(status === "ready" || status === "saving") && (
        <>
          {error && (
            <p role="alert" style={{ fontSize: 14, color: "var(--color-danger)", fontWeight: 500 }}>
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13 }}>
              <span className="text-muted">New password</span>
              <input
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13 }}>
              <span className="text-muted">Confirm new password</span>
              <input
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={inputStyle}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Update password"}
            </button>
          </form>
        </>
      )}

      {status === "done" && (
        <p role="status" style={{ fontSize: 14, fontWeight: 500 }}>
          Password updated. Taking you to sign-in…
        </p>
      )}
    </div>
  );
}
