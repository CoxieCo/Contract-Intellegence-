"use client";

// The pre-scan marketing/landing page — hero, features, how-it-works,
// workspace showcase, contract coverage, pricing and FAQ. Deliberately a
// different, lighter theme than the rest of the app (scoped under
// .ci-landing in landing.css); never rendered once a contract has actually
// been analyzed — app/page.tsx swaps this out for the real results view.

import { ChangeEvent, DragEvent, RefObject, useState } from "react";
import "./landing.css";
import HeroDemo from "./HeroDemo";
import UploadPanel, { UploadAppState } from "./UploadPanel";
import CoverageAccordion from "./CoverageAccordion";
import FaqAccordion from "./FaqAccordion";
import { IconArrowRight, IconCalendar, IconCheck, IconFileCheck, IconFileText, IconList, IconMessage } from "./icons";

interface LandingProps {
  appState: UploadAppState;
  selectedFile: File | null;
  isDragging: boolean;
  error: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  uploadSectionRef: RefObject<HTMLDivElement | null>;
  onFileInput: (e: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onRemoveClick: () => void;
  onContinueClick: () => void;
  onScanCta: () => void;
  formatFileSize: (bytes: number) => string;
}

const PRICING_TIERS = [
  {
    name: "FREE",
    price: "$0",
    period: "/TRIAL",
    description: "Explore the scanner before committing.",
    features: ["Upload contracts", "Basic document scanning", "Core extraction", "Sample contract analysis"],
    cta: "Get Started",
    note: "No card required",
    highlighted: false,
  },
  {
    name: "PRO",
    price: "$29",
    period: "/MONTH",
    description: "Full contract intelligence for teams.",
    features: [
      "Unlimited contract analysis",
      "Renewal and notice extraction",
      "Contract Q&A",
      "Advanced clause extraction",
      "Structured contract summaries",
      "Exportable intelligence",
      "Team workflows",
    ],
    cta: "Start Scanning",
    note: "Cancel anytime",
    highlighted: true,
  },
  {
    name: "BUSINESS",
    price: "Custom",
    period: "",
    description: "Contract intelligence across your operation.",
    features: ["Team access", "Higher limits", "Advanced controls", "Priority support", "Security controls", "Enterprise workflows"],
    cta: "Talk to Sales",
    note: "Tailored onboarding",
    highlighted: false,
  },
];

const RESULT_CARDS = [
  { badge: "RENEWAL", value: "18 March 2027", note: "120-day notice period", cite: "Section 12.2" },
  { badge: "PARTIES", value: "Acme Corp × Example Supplier", note: "Effective from 18 March 2025", cite: "Agreement Overview" },
  {
    badge: "AUTO-RENEWAL",
    value: "Renews for two (2) years commencing on expiry of the Initial Term",
    note: "Unless written notice is given within the notice window",
    cite: "Item 13, Special Condition 1,4",
    small: true,
  },
  { badge: "PAYMENT TERMS", value: "Net 30", note: "Invoices payable within 30 days", cite: "Section 7.1" },
  { badge: "TERMINATION", value: "30 days written notice", note: "Termination rights defined in Section 14", cite: "Section 14" },
  { badge: "LIABILITY", value: "Liability capped", note: "Maximum contractual liability defined in the agreement", cite: "Section 18" },
];

const dim = "color-mix(in srgb, var(--color-text) 55%, transparent)";
const dim70 = "color-mix(in srgb, var(--color-text) 78%, transparent)";

function SectionKicker({ n, label }: { n: string; label: string }) {
  return (
    <>
      <span style={{ display: "block", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-accent-700)", marginBottom: 12 }}>
        {n} · {label}
      </span>
      <hr style={{ height: 1, border: 0, background: "var(--color-divider)", margin: "0 0 20px" }} />
    </>
  );
}

export default function Landing(props: LandingProps) {
  const { onScanCta } = props;
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    navigator.clipboard?.writeText("support@contractintelligence.com").catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ci-landing">
      {/* NAV */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: "color-mix(in srgb, var(--color-bg) 92%, transparent)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--color-divider)",
          padding: "10px clamp(20px,5vw,72px)",
        }}
      >
        <span className="nav-brand" style={{ textTransform: "uppercase", letterSpacing: "0.02em", marginRight: "auto" }}>
          Contract Intelligence
        </span>
        <div className="nav-links">
          <a href="#product">Product</a>
          <a href="#how">How It Works</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button type="button" className="btn btn-ghost">Sign In</button>
          <button type="button" className="btn btn-primary" onClick={onScanCta}>Scan a Contract</button>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 clamp(20px,5vw,72px)" }}>
        {/* HERO */}
        <section id="product" data-screen-label="Hero" style={{ padding: "clamp(56px,7vw,96px) 0 24px" }}>
          <span style={{ display: "block", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-accent-700)", marginBottom: 16 }}>
            AI contract intelligence
          </span>
          <h1 style={{ fontSize: "clamp(44px,6.5vw,88px)", lineHeight: 1.04, letterSpacing: "0.01em", textTransform: "uppercase", margin: "0 0 0 -0.05em" }}>
            <span style={{ display: "block" }}>Turn long contracts</span>
            <span style={{ display: "block" }}>into clear answers.</span>
          </h1>
          <p style={{ fontSize: 16, lineHeight: "24px", maxWidth: "60ch", margin: "28px 0 0", color: dim70 }}>
            Upload a contract, let AI analyse it, and instantly surface the terms, dates and obligations that matter —
            each one cited back to the page and clause it came from.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
            <button type="button" className="btn btn-primary" onClick={onScanCta}>Scan a Contract</button>
            <a href="#how" className="btn btn-ghost" style={{ display: "inline-flex", alignItems: "center" }}>See How It Works</a>
          </div>

          <HeroDemo />
          <p style={{ margin: "12px 2px 0", fontSize: 12, color: dim }}>Shown with a sample contract for illustration.</p>
        </section>

        {/* FEATURES */}
        <section id="features" data-screen-label="Features" style={{ padding: "72px 0 24px" }}>
          <SectionKicker n="02" label="What it does" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "clamp(24px,3vw,44px)" }}>
            <div className="blueprint" style={{ padding: 24 }}>
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              <IconFileText />
              <h2 style={{ fontSize: 22, lineHeight: "24px", letterSpacing: "0.02em", textTransform: "uppercase", margin: "16px 0 0" }}>
                Instant contract extraction
              </h2>
              <p style={{ fontSize: 15, lineHeight: "24px", margin: "10px 0 18px", color: dim70 }}>
                Upload a PDF and let the system identify the important information without manually searching page after page.
              </p>
              <div style={{ border: "1px solid var(--color-divider)", padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14, alignItems: "center" }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ height: 4, background: "color-mix(in srgb, var(--color-text) 16%, transparent)" }} />
                  <span style={{ height: 4, background: "color-mix(in srgb, var(--color-text) 16%, transparent)", width: "82%" }} />
                  <span style={{ height: 4, background: "var(--color-accent)", width: "64%" }} />
                  <span style={{ height: 4, background: "color-mix(in srgb, var(--color-text) 16%, transparent)", width: "90%" }} />
                </div>
                <IconArrowRight />
                <div style={{ display: "grid", gap: 6, fontSize: 11 }}>
                  <span style={{ border: "1px solid var(--color-divider)", padding: "3px 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Parties · Acme × Supplier
                  </span>
                  <span style={{ border: "1px solid var(--color-divider)", padding: "3px 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Renewal · 14 Aug 2027
                  </span>
                </div>
              </div>
            </div>

            <div className="blueprint" style={{ padding: 24 }}>
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              <IconCalendar />
              <h2 style={{ fontSize: 22, lineHeight: "24px", letterSpacing: "0.02em", textTransform: "uppercase", margin: "16px 0 0" }}>
                Never miss the important dates
              </h2>
              <p style={{ fontSize: 15, lineHeight: "24px", margin: "10px 0 18px", color: dim70 }}>
                Surface renewal dates, expiry dates, notice periods and auto-renewal clauses before they become operational problems.
              </p>
              <div style={{ border: "1px solid var(--color-divider)", padding: "20px 16px 14px" }}>
                <div style={{ position: "relative", height: 1, background: "color-mix(in srgb, var(--color-text) 20%, transparent)", margin: "0 6px" }}>
                  <span style={{ position: "absolute", left: 0, top: -3, width: 7, height: 7, background: "color-mix(in srgb, var(--color-text) 45%, transparent)" }} />
                  <span style={{ position: "absolute", left: "58%", top: -3, width: 7, height: 7, background: "var(--color-accent)" }} />
                  <span style={{ position: "absolute", right: 0, top: -3, width: 7, height: 7, border: "1px solid color-mix(in srgb, var(--color-text) 45%, transparent)" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 10, fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: dim }}>
                  <span>Today</span>
                  <span style={{ color: "var(--color-accent-700)" }}>Notice deadline</span>
                  <span>Renewal</span>
                </div>
              </div>
            </div>

            <div className="blueprint" style={{ padding: 24 }}>
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              <IconList />
              <h2 style={{ fontSize: 22, lineHeight: "24px", letterSpacing: "0.02em", textTransform: "uppercase", margin: "16px 0 0" }}>
                Understand the important terms
              </h2>
              <p style={{ fontSize: 15, lineHeight: "24px", margin: "10px 0 18px", color: dim70 }}>
                Extract payment terms, termination conditions, SLA commitments, liability information and other important contractual obligations.
              </p>
              <div style={{ border: "1px solid var(--color-divider)", padding: "12px 16px", display: "grid", gap: 8, fontSize: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><IconCheck />Payment · Net 30, invoices monthly in advance</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><IconCheck />Termination · 60 days’ written notice</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><IconCheck />Liability · Capped at $250,000</span>
              </div>
            </div>

            <div className="blueprint" style={{ padding: 24 }}>
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              <IconMessage />
              <h2 style={{ fontSize: 22, lineHeight: "24px", letterSpacing: "0.02em", textTransform: "uppercase", margin: "16px 0 0" }}>
                Ask questions in plain English
              </h2>
              <p style={{ fontSize: 15, lineHeight: "24px", margin: "10px 0 18px", color: dim70 }}>
                Ask questions about an uploaded contract and receive answers grounded in the document.
              </p>
              <div style={{ border: "1px solid var(--color-divider)", padding: "12px 16px", display: "grid", gap: 8, fontSize: 12 }}>
                <span style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>Q · When does this agreement renew?</span>
                <span>A · 14 Aug 2027, with 90 days’ notice required.</span>
                <span style={{ justifySelf: "start", border: "1px solid var(--color-divider)", padding: "2px 8px", fontSize: 11, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                  S9.1 · Page 2
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: "clamp(24px,3vw,44px)", marginTop: 56 }}>
            {[
              ["Stop digging through long PDFs manually.", "The scanner surfaces the information that matters instead of forcing teams to search page by page."],
              ["Know the important dates before they become problems.", "Renewal and notice information is made visible and easy to understand."],
              ["Ask the document directly.", "Use plain-English questions instead of manually hunting through sections."],
              ["Turn documents into structured intelligence.", "Long unstructured PDFs become clear fields, answers and actionable information."],
            ].map(([title, body]) => (
              <div key={title}>
                <hr style={{ height: 1, border: 0, background: "var(--color-divider)", margin: "0 0 14px" }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</p>
                <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: "20px", color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" data-screen-label="How it works" style={{ padding: "88px 0 24px" }}>
          <SectionKicker n="03" label="How it works" />
          <h2 style={{ fontSize: "clamp(28px,3.4vw,44px)", lineHeight: 1.06, letterSpacing: "0.01em", textTransform: "uppercase", margin: "0 0 40px" }}>
            Upload → Scan → Extract → Ask
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))", gap: "clamp(20px,2.5vw,36px)" }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>01</span>
              <h3 style={{ fontSize: 19, lineHeight: "24px", letterSpacing: "0.02em", textTransform: "uppercase", margin: "8px 0 6px" }}>Upload your PDF</h3>
              <p style={{ fontSize: 14, lineHeight: "21px", margin: "0 0 14px", color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                Drop the contract in. Any PDF, any length.
              </p>
              <div style={{ border: "1px dashed color-mix(in srgb, var(--color-text) 35%, transparent)", padding: 16, textAlign: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M17 8l-5-5-5 5" />
                  <path d="M12 3v12" />
                </svg>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                  Retail_Lease_Agreement.pdf<br />62 pages
                </p>
              </div>
            </div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>02</span>
              <h3 style={{ fontSize: 19, lineHeight: "24px", letterSpacing: "0.02em", textTransform: "uppercase", margin: "8px 0 6px" }}>Let AI analyse it</h3>
              <p style={{ fontSize: 14, lineHeight: "21px", margin: "0 0 14px", color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                Every page is read against a fixed extraction schema.
              </p>
              <div style={{ border: "1px solid var(--color-divider)", padding: 16 }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "color-mix(in srgb, var(--color-text) 60%, transparent)", fontFeatureSettings: "'tnum' 1" }}>
                  Scanning page 41 of 62…
                </p>
                <div style={{ height: 2, background: "color-mix(in srgb, var(--color-text) 10%, transparent)" }}>
                  <div style={{ height: "100%", width: "66%", background: "var(--color-accent)" }} />
                </div>
              </div>
            </div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>03</span>
              <h3 style={{ fontSize: 19, lineHeight: "24px", letterSpacing: "0.02em", textTransform: "uppercase", margin: "8px 0 6px" }}>Get structured intelligence</h3>
              <p style={{ fontSize: 14, lineHeight: "21px", margin: "0 0 14px", color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                Fields, clauses and flags — exactly as written, or “Not found”.
              </p>
              <div style={{ border: "1px solid var(--color-divider)", padding: "12px 14px", display: "grid", gap: 7, fontSize: 12 }}>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Parties</span>
                  <span style={{ textAlign: "right" }}>Acme × Landlord Pty Ltd</span>
                </span>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Notice</span>
                  <span style={{ textAlign: "right" }}>3 months before expiry</span>
                </span>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Auto-renewal</span>
                  <span style={{ textAlign: "right" }}>Yes</span>
                </span>
              </div>
            </div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>04</span>
              <h3 style={{ fontSize: 19, lineHeight: "24px", letterSpacing: "0.02em", textTransform: "uppercase", margin: "8px 0 6px" }}>Ask questions and act</h3>
              <p style={{ fontSize: 14, lineHeight: "21px", margin: "0 0 14px", color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                Answers come from the document, with the source cited.
              </p>
              <div style={{ border: "1px solid var(--color-divider)", padding: "12px 14px", display: "grid", gap: 8, fontSize: 12 }}>
                <span style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>When does this agreement renew?</span>
                <span>On expiry of the Initial Term, for two (2) further years.</span>
                <span style={{ justifySelf: "start", border: "1px solid var(--color-divider)", padding: "2px 8px", fontSize: 11, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                  Item 13, Special Condition 1,4
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* WORKSPACE SHOWCASE */}
        <section data-screen-label="Product showcase" style={{ padding: "88px 0 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))", gap: "clamp(28px,4vw,72px)", alignItems: "start" }}>
            <div>
              <span style={{ display: "block", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-accent-700)", marginBottom: 12 }}>
                04 · The workspace
              </span>
              <hr style={{ height: 1, border: 0, background: "var(--color-divider)", margin: "0 0 20px" }} />
              <h2 style={{ fontSize: "clamp(26px,2.8vw,36px)", lineHeight: 1.1, letterSpacing: "0.01em", textTransform: "uppercase" }}>
                The PDF and its intelligence, side by side
              </h2>
              <p style={{ fontSize: 15, lineHeight: "24px", margin: "18px 0 0", maxWidth: "48ch", color: dim70 }}>
                Every extracted field points back at the clause it came from. Real contracts rarely give short answers —
                a renewal term can be a full sentence, a citation can span multiple items — so the workspace is built for
                values of any length, never a truncated box.
              </p>
              <p style={{ fontSize: 15, lineHeight: "24px", margin: "14px 0 0", maxWidth: "48ch", color: dim70 }}>
                When something needs attention — a tight notice window, an escalating fee — it’s flagged as a thing to
                watch, with the reasoning spelled out.
              </p>
              <div style={{ marginTop: 24 }}>
                <button type="button" className="btn btn-primary" onClick={onScanCta}>Scan a Contract</button>
              </div>
            </div>

            <div className="blueprint" style={{ background: "var(--color-bg)" }}>
              <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--color-divider)", padding: "10px 16px" }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>
                  Retail_Lease_Agreement.pdf{" "}
                  <span style={{ fontWeight: 400, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", fontFeatureSettings: "'tnum' 1" }}>· 62 pages</span>
                </span>
                <span className="tag tag-outline">Analyzed</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,2fr) 3fr" }}>
                <div style={{ borderRight: "1px solid var(--color-divider)", padding: "16px 14px" }}>
                  <div style={{ display: "grid", gap: 5 }}>
                    <span style={{ height: 3, background: "color-mix(in srgb, var(--color-text) 14%, transparent)" }} />
                    <span style={{ height: 3, background: "color-mix(in srgb, var(--color-text) 14%, transparent)", width: "84%" }} />
                    <span style={{ height: 3, background: "color-mix(in srgb, var(--color-text) 14%, transparent)", width: "92%" }} />
                    <span style={{ height: 3, background: "color-mix(in srgb, var(--color-text) 14%, transparent)", width: "70%" }} />
                  </div>
                  <div style={{ border: "1px solid var(--color-accent)", background: "color-mix(in srgb, var(--color-accent) 8%, transparent)", padding: 8, margin: "10px 0" }}>
                    <span style={{ display: "block", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-accent-700)", marginBottom: 5 }}>
                      Item 13 · Special Condition 1,4
                    </span>
                    <span style={{ display: "grid", gap: 4 }}>
                      <span style={{ height: 3, background: "color-mix(in srgb, var(--color-accent) 45%, transparent)" }} />
                      <span style={{ height: 3, background: "color-mix(in srgb, var(--color-accent) 45%, transparent)", width: "78%" }} />
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: 5 }}>
                    <span style={{ height: 3, background: "color-mix(in srgb, var(--color-text) 14%, transparent)", width: "88%" }} />
                    <span style={{ height: 3, background: "color-mix(in srgb, var(--color-text) 14%, transparent)" }} />
                    <span style={{ height: 3, background: "color-mix(in srgb, var(--color-text) 14%, transparent)", width: "62%" }} />
                  </div>
                  <p style={{ margin: "12px 0 0", fontSize: 10, color: "color-mix(in srgb, var(--color-text) 50%, transparent)", fontFeatureSettings: "'tnum' 1" }}>Page 4 of 62</p>
                </div>
                <div style={{ padding: "16px 18px 20px" }}>
                  <span style={{ display: "block", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 8 }}>
                    Important dates
                  </span>
                  <div style={{ padding: "9px 0", borderBottom: "1px solid var(--color-divider)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                        Renewal term
                      </span>
                      <span style={{ border: "1px solid var(--color-divider)", padding: "1px 7px", fontSize: 10, color: "color-mix(in srgb, var(--color-text) 70%, transparent)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Item 13, Special Condition 1,4
                      </span>
                    </div>
                    <span style={{ fontSize: 13, lineHeight: "19px", fontWeight: 600, overflowWrap: "break-word" }}>
                      Two (2) years commencing on expiry of the Initial Term
                    </span>
                  </div>
                  <div style={{ padding: "9px 0", borderBottom: "1px solid var(--color-divider)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                        Notice period
                      </span>
                      <span style={{ border: "1px solid var(--color-divider)", padding: "1px 7px", fontSize: 10, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                        Special Condition 4.2
                      </span>
                    </div>
                    <span style={{ fontSize: 13, lineHeight: "19px", fontWeight: 600, overflowWrap: "break-word" }}>
                      Not less than three (3) months prior to expiry of the then-current term
                    </span>
                  </div>
                  <div style={{ padding: "9px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
                        Liability cap
                      </span>
                    </div>
                    <span style={{ fontSize: 13, lineHeight: "19px", fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Not found</span>
                  </div>
                  <span style={{ display: "block", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", margin: "14px 0 8px" }}>
                    Things to watch
                  </span>
                  <div style={{ border: "1px solid var(--color-divider)", padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span className="tag tag-outline" style={{ fontSize: 10 }}>HIGH</span>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Conditional renewal mechanism</span>
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: 11, lineHeight: "17px", color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                      Renewal is tied to expiry of the Initial Term and requires notice at least three months out — the deadline moves with the term.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COVERAGE */}
        <section id="coverage" data-screen-label="Contract coverage" style={{ padding: "88px 0 32px" }}>
          <SectionKicker n="05" label="What it can find" />
          <h2 style={{ fontSize: "clamp(28px,3.4vw,44px)", lineHeight: 1.06, letterSpacing: "0.01em", textTransform: "uppercase", margin: "0 0 12px" }}>
            Contract coverage
          </h2>
          <p style={{ fontSize: 15, lineHeight: "24px", margin: "0 0 36px", maxWidth: "60ch", color: dim70 }}>
            Ten categories of contractual information, extracted against a fixed schema. Anything the document doesn’t
            state comes back as “Not found” — never a guess.
          </p>
          <CoverageAccordion />
        </section>

        {/* SAMPLE RESULTS */}
        <section id="results" data-screen-label="Sample results" style={{ padding: "88px 0 32px" }}>
          <SectionKicker n="06" label="What you get" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: "clamp(20px,2.5vw,36px)", alignItems: "stretch" }}>
            {RESULT_CARDS.map((card) => (
              <div key={card.badge} className="blueprint" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
                <span className="tag tag-outline" style={{ alignSelf: "flex-start" }}>{card.badge}</span>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: card.small ? 22 : 26, lineHeight: 1.15, overflowWrap: "break-word" }}>
                  {card.value}
                </span>
                <span style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>{card.note}</span>
                <span style={{ marginTop: "auto", fontSize: 11, color: dim }}>{card.cite}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", padding: "64px 0 8px" }}>
            <p style={{ margin: "0 0 20px", fontSize: 16, color: dim70 }}>See how long contracts become structured, actionable intelligence.</p>
            <button type="button" className="btn btn-primary" onClick={onScanCta}>Scan a Contract</button>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" data-screen-label="Pricing" style={{ padding: "88px 0 32px" }}>
          <SectionKicker n="07" label="Pricing" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,290px),1fr))", gap: "clamp(24px,3vw,44px)", alignItems: "stretch" }}>
            {PRICING_TIERS.map((tier) => (
              <div
                key={tier.name}
                className="blueprint"
                style={{
                  padding: "28px 24px",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  ...(tier.highlighted ? { borderColor: "var(--color-accent)", boxShadow: "inset 0 0 0 1px var(--color-accent)" } : {}),
                }}
              >
                <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
                {tier.highlighted && (
                  <span
                    style={{
                      position: "absolute",
                      top: -11,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "var(--color-accent)",
                      color: "var(--color-bg)",
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      fontWeight: 600,
                      padding: "4px 12px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    MOST POPULAR
                  </span>
                )}
                <span style={{ fontSize: 11, letterSpacing: "0.08em", fontWeight: 600, color: tier.highlighted ? "var(--color-accent-700)" : "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                  {tier.name}
                </span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "14px 0 8px" }}>
                  <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 44, lineHeight: 1, fontFeatureSettings: "'tnum' 1" }}>{tier.price}</span>
                  {tier.period && <span style={{ fontSize: 12, letterSpacing: "0.06em", color: dim }}>{tier.period}</span>}
                </div>
                <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: "21px", color: dim70 }}>{tier.description}</p>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10, fontSize: 14 }}>
                  {tier.features.map((f) => (
                    <li key={f} style={{ display: "flex", gap: 9, alignItems: "baseline" }}>
                      <span style={{ transform: "translateY(1px)" }}><IconCheck /></span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: "auto", paddingTop: 24 }}>
                  <button type="button" className={`btn btn-block ${tier.highlighted ? "btn-primary" : "btn-secondary"}`} onClick={onScanCta}>
                    {tier.cta}
                  </button>
                  <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 11, color: dim }}>{tier.note}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" data-screen-label="FAQ" style={{ padding: "88px 0 32px" }}>
          <SectionKicker n="08" label="Questions" />
          <FaqAccordion />
          <div className="blueprint" style={{ maxWidth: 560, margin: "64px auto 0", padding: "36px 32px", textAlign: "center" }}>
            <i className="corner tl" /><i className="corner tr" /><i className="corner bl" /><i className="corner br" />
            <h3 style={{ fontSize: 24, lineHeight: "26px", letterSpacing: "0.02em", textTransform: "uppercase" }}>Still have a question?</h3>
            <p style={{ margin: "12px 0 20px", fontSize: 14, lineHeight: "22px", color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
              Talk to our team about how contract intelligence could fit your workflow.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>support@contractintelligence.com</span>
              <button type="button" className="btn btn-secondary" onClick={copyEmail}>{copied ? "Copied ✓" : "Copy Email"}</button>
            </div>
          </div>
        </section>

        {/* CONFIDENCE CLOSER */}
        <section data-screen-label="Confidence closer" style={{ padding: "112px 0 96px", textAlign: "center" }}>
          <div style={{ marginBottom: 20 }}>
            <IconFileCheck />
          </div>
          <h2 style={{ fontSize: "clamp(32px,4.5vw,56px)", lineHeight: 1.05, letterSpacing: "0.01em", textTransform: "uppercase" }}>
            Stop searching. Start knowing.
          </h2>
          <p style={{ fontSize: 16, lineHeight: "25px", maxWidth: "52ch", margin: "20px auto 28px", color: dim70 }}>
            Long contracts contain the information your team needs. The scanner makes that information easier to find,
            understand and act on.
          </p>
          <button type="button" className="btn btn-primary" onClick={onScanCta}>Scan a Contract</button>
        </section>

        {/* FINAL CTA */}
        <section data-screen-label="Final CTA" style={{ padding: "120px 0 140px", textAlign: "center", borderTop: "1px solid var(--color-divider)" }}>
          <span style={{ display: "block", fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, color: "var(--color-accent-700)", marginBottom: 24 }}>
            Start scanning
          </span>
          <h2 style={{ fontSize: "clamp(34px,5vw,64px)", lineHeight: 1.05, letterSpacing: "0.01em", textTransform: "uppercase", maxWidth: "20ch", margin: "0 auto" }}>
            Your next contract review doesn’t need to start with 80 pages.
          </h2>
          <p style={{ fontSize: 16, lineHeight: "25px", margin: "24px auto 36px", maxWidth: "48ch", color: dim70 }}>
            Upload the PDF, let the AI analyse it, and get the information that matters.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={onScanCta}>Scan a Contract</button>
            <a href="#pricing" className="btn btn-ghost" style={{ display: "inline-flex", alignItems: "center" }}>See Pricing</a>
          </div>
          <p style={{ margin: "32px 0 0", fontSize: 12, letterSpacing: "0.03em", color: dim }}>
            Secure document processing · Built for teams · Start in seconds
          </p>
        </section>
      </div>

      {/* Real, functional upload — the actual entry point behind every "Scan a Contract" CTA above */}
      <UploadPanel
        appState={props.appState}
        selectedFile={props.selectedFile}
        isDragging={props.isDragging}
        error={props.error}
        fileInputRef={props.fileInputRef}
        uploadSectionRef={props.uploadSectionRef}
        onFileInput={props.onFileInput}
        onDrop={props.onDrop}
        onDragOver={props.onDragOver}
        onDragLeave={props.onDragLeave}
        onRemoveClick={props.onRemoveClick}
        onContinueClick={props.onContinueClick}
        formatFileSize={props.formatFileSize}
      />

      {/* FOOTER */}
      <footer data-screen-label="Footer" style={{ borderTop: "1px solid var(--color-divider)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "64px clamp(20px,5vw,72px) 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: "40px clamp(24px,3vw,48px)" }}>
            <div style={{ gridColumn: "1 / -1", maxWidth: 340 }}>
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 19, letterSpacing: "0.02em", textTransform: "uppercase" }}>
                Contract Intelligence
              </span>
              <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: "21px", maxWidth: "32ch", color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
                AI-powered contract intelligence that turns long PDF documents into structured, actionable information.
              </p>
            </div>
            <div>
              <span style={{ display: "block", fontSize: 11, letterSpacing: "0.08em", fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 14 }}>
                PRODUCT
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <a href="#how">How It Works</a>
                <a href="#product">Contract Scanner</a>
                <a href="#product">Ask Your Contract</a>
                <a href="#coverage">Contract Intelligence</a>
                <a href="#features">Features</a>
                <a href="#pricing">Pricing</a>
                <a href="#upload">Get Started</a>
              </div>
            </div>
            <div>
              <span style={{ display: "block", fontSize: 11, letterSpacing: "0.08em", fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 14 }}>
                USE CASES
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <a href="#coverage">Contract Review</a>
                <a href="#coverage">Renewal Tracking</a>
                <a href="#coverage">Vendor Contracts</a>
                <a href="#coverage">Customer Agreements</a>
                <a href="#coverage">Procurement</a>
                <a href="#coverage">Operations</a>
                <a href="#coverage">Legal Operations</a>
                <a href="#coverage">Contract Management</a>
              </div>
            </div>
            <div>
              <span style={{ display: "block", fontSize: 11, letterSpacing: "0.08em", fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 14 }}>
                RESOURCES
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <a href="#faq">FAQ</a>
                <a href="#how">Contract Intelligence Guide</a>
                <a href="#faq">Contact Support</a>
              </div>
            </div>
            <div>
              <span style={{ display: "block", fontSize: 11, letterSpacing: "0.08em", fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 55%, transparent)", marginBottom: 14 }}>
                LEGAL
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
                <a href="#faq">Privacy Policy</a>
                <a href="#faq">Terms of Service</a>
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              borderTop: "1px solid var(--color-divider)",
              marginTop: 56,
              padding: "20px 0 28px",
              fontSize: 12,
              color: dim,
            }}
          >
            <span>© 2026 Contract Intelligence. All Rights Reserved.</span>
            <span>Secure Processing · Privacy Focused · Built for Teams</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
