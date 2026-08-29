"use client";

import { Google_Sans } from "next/font/google";

// Google's own "Sign in with Google" branding guidelines
// (https://developers.google.com/identity/branding-guidelines) are a
// published external spec, not a creative choice — this button is built to
// match it rather than approximate it:
//
//   * Logo: the official multicolor "G" mark. Guidelines forbid recoloring,
//     resizing independent of the button, or substituting a monochrome/icon-
//     font stand-in — it must be the real gradient mark, so it's inlined
//     below as the verbatim official artwork rather than redrawn.
//   * Colors/text (light theme — this page's theme): fill #FFFFFF, 1px
//     inside stroke #747775, text #1F1F1F.
//   * Font: Google Sans Medium (weight 500), 14px/20px line-height — loaded
//     via next/font/google as a local, component-scoped font (it's genuinely
//     in the Google Fonts catalog) rather than the app's own Barlow/Geist,
//     since the guidelines specify this typeface by name.
//   * Padding: 12px before the logo, 10px after it and before the text —
//     the exact numbers the guidelines publish for web buttons.
//   * Height 40px and 4px corner radius match Google's own rendered button
//     (the current "rectangular" shape in their button generator) — the
//     guidelines page documents colors/padding/font as literal text but
//     don't spell out radius/height in prose, so these two are taken from
//     Google's actual shipped button rather than a quoted number.
//
// "Continue with Google" is one of the three call-to-action strings the
// guidelines explicitly approve ("Sign in with Google" / "Sign up with
// Google" / "Continue with Google") — chosen because this button is shared
// between the form's sign-in and sign-up modes, where "Sign in" would read
// oddly while creating an account.

const googleSans = Google_Sans({
  weight: "500",
  subsets: ["latin"],
});

// The official multicolor "G" mark — verbatim artwork (clip-path + four flat
// color quadrants), not a redrawn approximation. Guidelines forbid altering
// its color or proportions independent of the button.
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" style={{ flex: "none" }}>
      <clipPath id="google-g-clip">
        <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" />
      </clipPath>
      <g clipPath="url(#google-g-clip)">
        <path fill="#FBBC05" d="M0 37V11l17 13z" />
        <path fill="#EA4335" d="M0 11l17 13 7-6.1L48 14V0H0z" />
        <path fill="#34A853" d="M0 37l30-23 7.9 1L48 0v48H0z" />
        <path fill="#4285F4" d="M48 48L17 24l-4-3 35-10z" />
      </g>
    </svg>
  );
}

export default function GoogleSignInButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={googleSans.className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: 40,
        borderRadius: 4,
        background: "#FFFFFF",
        border: "1px solid #747775",
        padding: "0 12px 0 12px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background-color 120ms, box-shadow 120ms",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        // Google's own hover elevation (Material's standard 1dp button
        // hover shadow) plus its 4% state-layer tint over the white fill.
        e.currentTarget.style.background = "rgba(66,133,244,0.04)";
        e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(60,64,67,.30), 0 1px 3px 1px rgba(60,64,67,.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#FFFFFF";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <GoogleLogo />
      <span
        style={{
          marginLeft: 10,
          fontSize: 14,
          lineHeight: "20px",
          fontWeight: 500,
          color: "#1F1F1F",
          whiteSpace: "nowrap",
        }}
      >
        Continue with Google
      </span>
    </button>
  );
}
