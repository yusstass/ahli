import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, homeFor } from "@/lib/session";
import { clientIp, rateLimited, safeNext, sameOrigin } from "@/lib/security";

const DUMMY = bcrypt.hashSync("not-a-real-password", 12); // equalises timing when the email is unknown
const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128), next: z.string().optional() });
const fail = () => NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail();
  const { email, password, next } = p.data;
  if (rateLimited(`login:${clientIp(req)}:${email}`)) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY);
  if (!user || !user.passwordHash || !ok || user.disabledAt) return fail();
  await createSession(user.id, req.headers.get("user-agent"));
  return NextResponse.json({ redirect: safeNext(next) ?? homeFor(user.role) });
}
