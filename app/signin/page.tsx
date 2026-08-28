import Link from "next/link";
import SignInForm from "@/app/components/auth/SignInForm";
import "../components/results/results.css";

// PLACEHOLDER route — see app/components/auth/SignInForm.tsx.
//
// A Server Component purely so the `?error=` that /auth/callback redirects
// here with can be read without a client-side Suspense boundary.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
          <SignInForm initialError={error} />
        </div>
      </main>
    </div>
  );
}
