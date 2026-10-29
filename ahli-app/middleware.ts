import { NextRequest, NextResponse } from "next/server";
// Fast redirect only. Real authorization happens on the server (requireAdmin / requireRole).
export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname, admin = p.startsWith("/admin");
  if (p === "/admin/login") return;
  if (!req.cookies.get("ahli_session"))
    return NextResponse.redirect(new URL(admin ? "/admin/login" : "/login?next=" + encodeURIComponent(p), req.url));
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store"); // pages contain personal data
  return res;
}
export const config = { matcher: ["/family/:path*", "/provider/:path*", "/admin/:path*"] };
