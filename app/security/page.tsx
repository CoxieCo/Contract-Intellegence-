import Link from "next/link";
import type { Metadata } from "next";
import "../components/results/results.css";

export const metadata: Metadata = {
  title: "Security & Trust — Contract Intelligence",
  description:
    "What happens to the contracts you upload to Contract Intelligence — what's retained, what never is, and how access is controlled.",
};

// Static trust page. Every claim here is verified against the codebase and
// the live production configuration:
//   * no PDF persistence — /api/analyze reads the file in memory only
//   * contract_text retained (supabase migration 0005)
//   * RLS on `analyses` (migration 0003) enforces the signed-in read path;
//     writes and the anonymous path run on the service-role key by design
//   * HSTS max-age=63072000; includeSubDomains; preload (verified on the
//     production domain), HTTP -> HTTPS 308
// Plain styling to match the placeholder /signin and /reset-password pages.

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 11,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        fontWeight: 600,
        color: "var(--color-accent)",
        margin: "0 0 10px",
      }}
    >
      {children}
    </p>
  );
}

function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section className="card blueprint" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      <div>
        <Kicker>{kicker}</Kicker>
        <h2 style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.3 }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

const p: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, margin: 0 };
const li: React.CSSProperties = { ...p, marginBottom: 8 };

export default function SecurityPage() {
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

      <main style={{ flex: 1, display: "flex", justifyContent: "center", padding: "48px 24px 80px" }}>
        <div style={{ width: "100%", maxWidth: 680, display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.25 }}>Security &amp; Trust</h1>
            <p className="text-muted" style={{ ...p, marginTop: 8 }}>
              You&rsquo;re uploading real business documents to get real answers. Here&rsquo;s exactly what happens to
              your data, and what doesn&rsquo;t.
            </p>
          </div>

          <Section kicker="What we never do" title="Your contract data isn't a product">
            <ul style={{ margin: 0, paddingLeft: 18, listStyle: "disc" }}>
              <li style={li}>
                <strong>Your contract data is never used to train AI models, and never sold or shared for anyone
                else&rsquo;s purposes.</strong> It is used for one thing: running the extraction and analysis you asked
                for.
              </li>
              <li style={li}>
                <strong>We never store your original PDF file.</strong> Not in a file bucket, not in a temporary
                folder, not anywhere. It&rsquo;s read once, in memory on our server, to extract the text &mdash; then
                discarded.
              </li>
            </ul>
          </Section>

          <Section kicker="Who processes your data" title="The one third party involved">
            <p style={p}>
              The only third party that receives your contract text is our AI provider,{" "}
              <a href="https://www.anthropic.com" target="_blank" rel="noopener noreferrer">
                Anthropic
              </a>
              , which processes it solely to perform your analysis. Per Anthropic&rsquo;s API terms, data sent through
              the API is not used to train their models.
            </p>
          </Section>

          <Section kicker="What we retain, and why" title="The extracted text, so you can come back to it">
            <p style={p}>
              To let you reopen a past analysis and keep asking questions about it later, we retain the extracted{" "}
              <em>text content</em> of your contract &mdash; not the PDF itself, but the words it contains. This is
              protected by the same per-account access controls as everything else in your dashboard: only you can
              read it.
            </p>
            <p style={p}>
              The original file also stays in your <em>browser&rsquo;s</em> memory for the length of your session, so
              that a citation can reopen the source PDF on the exact page it came from. It is never re-uploaded, and
              it&rsquo;s gone when you close the tab.
            </p>
          </Section>

          <Section kicker="How access is controlled" title="Enforced by the database, not just our code">
            <p style={p}>
              When you&rsquo;re signed in, reads of your analyses are enforced by database-level Row Level Security
              &mdash; not just checks in our application code. Even if a bug existed in our read path, Postgres itself
              would refuse to return another account&rsquo;s rows.
            </p>
            <p style={p}>
              We test this directly: two separate real accounts, real login sessions, real attempts to read and
              modify each other&rsquo;s data through every endpoint. Every cross-account attempt is rejected &mdash; at
              the application layer and, independently, at the database layer.
            </p>
          </Section>

          <Section kicker="In transit" title="Encrypted, and enforced by your browser">
            <p style={p}>
              Every connection to Contract Intelligence is encrypted. Plain HTTP requests are automatically redirected
              to HTTPS, and we send HSTS with a two-year policy covering all subdomains &mdash; so once your browser
              has seen the site, it refuses to connect insecurely even by mistake.
            </p>
          </Section>

          <Section kicker="Where we are today" title="Early-stage, and honest about it">
            <p style={p}>
              Contract Intelligence is an early-stage product. We haven&rsquo;t yet completed a formal third-party
              security audit or compliance certification (like SOC&nbsp;2) &mdash; those take time, and we&rsquo;d
              rather say that plainly than claim something that isn&rsquo;t true yet. What we can tell you is exactly
              what&rsquo;s described above: verified, specific, and true as of today.
            </p>
          </Section>

          <p className="text-muted" style={{ ...p, textAlign: "center", marginTop: 4 }}>
            Questions about how your data is handled?{" "}
            <a href="mailto:support@contractintelligence.com">support@contractintelligence.com</a>
          </p>
        </div>
      </main>
    </div>
  );
}
