"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import GoogleSignInButton from "./GoogleSignInButton";

// PLACEHOLDER UI. Phase 1 is the data model and access control; this exists
// only so the auth plumbing underneath it can actually be exercised and
// verified end to end. It is deliberately unstyled beyond the shared
// .ci-results tokens and expects to be replaced wholesale by the real
// designed sign-in surface in a later phase.

type Mode = "signin" | "signup";

// Only same-origin, non-protocol-relative paths survive — `next` can arrive
// in a link a third party crafted, and a bare startsWith("/") still lets
// "//evil.example" through as a protocol-relative redirect. Mirrors
// safeRedirectPath in app/auth/callback/route.ts (the OAuth/email flows go
// through that; this guards the password flow's own client-side push).
function safeNext(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export default function SignInForm({
  initialError,
  initialNotice,
  next,
}: {
  initialError?: string;
  initialNotice?: string;
  next?: string;
}) {
  const router = useRouter();
  const destination = safeNext(next);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState(initialNotice ?? "");

  // Both the OAuth round trip and the emailed confirmation link come back to
  // /auth/callback, which is where the session cookie actually gets written.
  const callbackUrl = (target = destination) =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    const supabase = createClient();

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl() },
      });
      setBusy(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      // This project has email confirmations turned on, so signUp returns a
      // user but no session — nothing is signed in until the emailed link is
      // clicked. Saying so explicitly avoids the "it said success but I'm
      // still logged out" confusion.
      if (!data.session) {
        setNotice(`Check ${email} for a confirmation link, then come back and sign in.`);
        return;
      }
      router.push(destination);
      router.refresh();
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push(destination);
    // The server needs to re-render with the new session cookie; without this
    // the dashboard can paint from a cached signed-out render.
    router.refresh();
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email above first, then choose reset.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");

    const supabase = createClient();
    // Routes through /auth/callback like every other email link — it verifies
    // the recovery token, writes the session cookies, then lands on
    // /reset-password (see app/auth/callback/route.ts and app/reset-password).
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }
    // Deliberately not confirming whether the address has an account.
    setNotice(`If an account exists for ${email}, a password reset link is on its way.`);
  }

  async function handleGoogle() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (oauthError) {
      setBusy(false);
      setError(oauthError.message);
    }
    // On success the browser is redirected away; no state to reset.
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
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>{mode === "signin" ? "Sign in" : "Create an account"}</h1>
        <p className="text-muted" style={{ marginTop: 4, fontSize: 14 }}>
          Placeholder sign-in — the designed version comes later.
        </p>
      </div>

      {error && (
        <p role="alert" style={{ fontSize: 14, color: "var(--color-danger)", fontWeight: 500 }}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" style={{ fontSize: 14, fontWeight: 500 }}>
          {notice}
        </p>
      )}

      <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13 }}>
          <span className="text-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13 }}>
          <span className="text-muted">Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>

      {mode === "signin" && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={handleForgotPassword}
          disabled={busy}
          style={{ fontSize: 13, alignSelf: "flex-start", padding: 0 }}
        >
          Forgot your password?
        </button>
      )}

      {/* Its own section, set apart from the form above — a labeled divider
          rather than just another item in the button stack, per Google's own
          "at least as prominent as other sign-in options" guideline and
          simple visual clarity between a typed-credentials flow and an
          identity-provider one. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
        <span className="text-muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Or
        </span>
        <span style={{ flex: 1, height: 1, background: "var(--color-divider)" }} />
      </div>

      <GoogleSignInButton onClick={handleGoogle} disabled={busy} />

      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError("");
          setNotice("");
        }}
        style={{ fontSize: 13 }}
      >
        {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
