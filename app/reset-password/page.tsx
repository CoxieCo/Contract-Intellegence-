import Link from "next/link";
import ResetPasswordForm from "@/app/components/auth/ResetPasswordForm";
import "../components/results/results.css";

// Where the password-recovery email link lands. Supabase verifies the emailed
// token at /auth/callback (?type=recovery), which writes the session cookies
// and redirects here — see app/auth/callback/route.ts. This page then lets the
// user actually choose a new password, which nothing did before (the link
// used to authenticate a recovery session and then drop the user on the
// homepage with no form).
//
// Matches the placeholder sign-in page's plain styling on purpose — same
// .ci-results tokens, same nav — and is expected to be redesigned alongside
// it later.
export default function ResetPasswordPage() {
  return (
    <div
      className="ci-results"
      style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", display: "flex", flexDirection: "column" }}
    >
      <nav className="nav" style={{ borderBottom: "1px solid var(--color-divider)", flex: "none" }}>
        <Link href="/" className="nav-brand" style={{ color: "var(--color-text)", marginRight: 0 }}>
          Contract Intelligence
        </Link>
      </nav>
      <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          <ResetPasswordForm />
        </div>
      </main>
    </div>
  );
}
