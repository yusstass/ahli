import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { audit } from "@/lib/admin";
import { clientIp, rateLimited, sameOrigin } from "@/lib/security";

const DUMMY = bcrypt.hashSync("not-a-real-password", 12);
const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });
const fail = () => NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
// Dedicated admin endpoint: only ADMIN users get a session here, with an 8-hour lifetime and a stricter limit.
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail();
  const { email, password } = p.data;
  if (rateLimited(`adm:${clientIp(req)}:${email}`, 5)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY);
  if (!user || !user.passwordHash || !ok || user.role !== "ADMIN" || user.disabledAt) return fail();
  await createSession(user.id, req.headers.get("user-agent"), 8 * 3600 * 1000);
  await audit(user.id, "admin.login", "User", user.id);
  return NextResponse.json({ redirect: "/admin" });
}
