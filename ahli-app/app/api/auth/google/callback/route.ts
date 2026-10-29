import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, homeFor } from "@/lib/session";
import { clientIp, rateLimited, safeNext } from "@/lib/security";

const TERMS_VERSION = "draft-1";
const APP = () => process.env.APP_URL!;
const clear = (r: NextResponse) => { r.cookies.set("ahli_oauth", "", { path: "/api/auth/google", maxAge: 0 }); return r; };
const back = (code: string) => clear(NextResponse.redirect(new URL("/login?error=" + code, APP())));

// Step 2: Google sends the browser back here with ?code and ?state.
export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  if (rateLimited("goog:" + ip, 20)) return back("google");
  const q = req.nextUrl.searchParams, code = q.get("code"), state = q.get("state");
  let saved: { state: string; verifier: string; next?: string | null } | null = null;
  try { saved = JSON.parse(Buffer.from(req.cookies.get("ahli_oauth")?.value ?? "", "base64url").toString()); } catch {}
  if (!code || !state || !saved || saved.state !== state) return back("google"); // blocks login CSRF

  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, grant_type: "authorization_code", code_verifier: saved.verifier,
      client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: new URL("/api/auth/google/callback", APP()).toString(),
    }),
  });
  if (!tok.ok) return back("google");
  const { access_token } = await tok.json();
  const ui = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` } });
  if (!ui.ok) return back("google");
  const info = await ui.json();
  if (!info.sub || !info.email || info.email_verified !== true) return back("google");
  const email = String(info.email).toLowerCase();

  const account = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: String(info.sub) } },
    include: { user: true },
  });
  let user = account?.user;
  if (!user) {
    // Never auto-link to an existing password account: AHLI does not verify those emails yet.
    if (await prisma.user.findUnique({ where: { email } })) return back("exists");
    user = await prisma.user.create({
      data: {
        email, role: "FAMILY", emailVerifiedAt: new Date(),
        name: String(info.name ?? email.split("@")[0]).slice(0, 80),
        family: { create: {} },
        accounts: { create: { provider: "google", providerAccountId: String(info.sub) } },
        terms: { create: ["terms", "privacy"].map((document) => ({ document, version: TERMS_VERSION, ip })) },
      },
    });
  }
  if (user.disabledAt) return back("google");
  await createSession(user.id, req.headers.get("user-agent"));
  return clear(NextResponse.redirect(new URL(safeNext(saved.next ?? undefined) ?? homeFor(user.role), APP())));
}
