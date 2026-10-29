import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { safeNext } from "@/lib/security";

// Step 1: send the browser to Google with a random state and a PKCE challenge.
export function GET(req: NextRequest) {
  const state = randomBytes(24).toString("base64url"), verifier = randomBytes(48).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: new URL("/api/auth/google/callback", process.env.APP_URL!).toString(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(url);
  const saved = { state, verifier, next: safeNext(req.nextUrl.searchParams.get("next") ?? undefined) };
  res.cookies.set("ahli_oauth", Buffer.from(JSON.stringify(saved)).toString("base64url"), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google", maxAge: 600,
  });
  return res;
}
