import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/supabase-server";

// Where the browser lands after Supabase Auth sends the visitor back, for
// both flows the project has turned on:
//
//   * Google OAuth  -> ?code=<pkce code>
//   * Email sign-up -> ?token_hash=<hash>&type=signup  (email confirmations
//                      are ON for this project, so a password sign-up has no
//                      session until this link is clicked)
//
// Both end the same way: a session written into cookies by @supabase/ssr, so
// proxy.ts and every route handler can see the user from here on.

// Only same-origin, non-protocol-relative paths — `next` arrives in a URL a
// third party can craft, and a bare startsWith("/") check still lets
// "//evil.example" through as a protocol-relative redirect.
function safeRedirectPath(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function errorRedirect(request: NextRequest, message: string) {
  const url = new URL("/signin", request.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"));

  // Supabase reports a refused/expired link by redirecting here with its own
  // error params rather than by failing the exchange below.
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return errorRedirect(request, providerError);
  }

  const supabase = await createUserClient();

  const code = searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("OAuth code exchange failed:", error.message);
      return errorRedirect(request, "Sign-in link could not be completed. Please try again.");
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      console.error("Email OTP verification failed:", error.message);
      return errorRedirect(request, "That confirmation link is invalid or has expired.");
    }
    return NextResponse.redirect(new URL(next, request.url));
  }

  return errorRedirect(request, "Missing sign-in credentials in the callback URL.");
}
