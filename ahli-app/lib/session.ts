import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "crypto";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

export const COOKIE = "ahli_session";
const TTL = 14 * 24 * 3600 * 1000;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
export const homeFor = (r: Role) => "/" + r.toLowerCase();

export async function createSession(userId: string, userAgent?: string | null, ttl = TTL) {
  const token = randomBytes(32).toString("base64url"), expiresAt = new Date(Date.now() + ttl);
  await prisma.session.create({ data: { tokenHash: sha(token), userId, expiresAt, userAgent: userAgent?.slice(0, 200) } });
  cookies().set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}
export async function getSession() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { tokenHash: sha(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date() || s.user.disabledAt) return null;
  const { id, name, email, role } = s.user;
  return { user: { id, name, email, role } };
}
export async function destroySession() {
  const token = cookies().get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha(token) } });
  cookies().delete(COOKIE);
}
// Call at the top of every protected page and API route. Middleware alone is not a security check.
export async function requireRole(...roles: Role[]) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!roles.includes(s.user.role)) redirect(homeFor(s.user.role));
  return s;
}
