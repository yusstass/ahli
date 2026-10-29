import { NextRequest } from "next/server";
// In-memory limiter: fine for one server. Use Redis/Upstash when running several instances.
const hits = new Map<string, { n: number; t: number }>();
export function rateLimited(key: string, max = 5, windowMs = 15 * 60_000) {
  const now = Date.now(), h = hits.get(key);
  if (!h || now - h.t > windowMs) { hits.set(key, { n: 1, t: now }); return false; }
  return ++h.n > max;
}
export const clientIp = (r: NextRequest) => r.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
// CSRF defence on top of SameSite=Lax: state-changing requests must come from our own origin.
export const sameOrigin = (r: NextRequest) => r.headers.get("origin") === new URL(process.env.APP_URL!).origin;
export const safeNext = (n?: string) => (n && n.startsWith("/") && !n.startsWith("//") ? n : null);
