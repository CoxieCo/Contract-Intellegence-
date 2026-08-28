"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

// PLACEHOLDER UI. Phase 1 is the data model and access control; this exists
// only so the auth plumbing underneath it can actually be exercised and
// verified end to end. It is deliberately unstyled beyond the shared
// .ci-results tokens and expects to be replaced wholesale by the real
// designed sign-in surface in a later phase.

type Mode = "signin" | "signup";

export default function SignInForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");

  // Both the OAuth round trip and the emailed confirmation link come back to
  // /auth/callback, which is where the session cookie actually gets written.
  const callbackUrl = (next = "/dashboard") =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

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
      router.push("/dashboard");
      router.refresh();
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/dashboard");
    // The server needs to re-render with the new session cookie; without this
    // the dashboard can paint from a cached signed-out render.
    router.refresh();
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

      <button type="button" className="btn btn-secondary" onClick={handleGoogle} disabled={busy}>
        Continue with Google
      </button>

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
