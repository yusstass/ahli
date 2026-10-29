import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, homeFor } from "@/lib/session";
import { clientIp, rateLimited, sameOrigin } from "@/lib/security";

const TERMS_VERSION = "draft-1"; // bump when legal documents change
const schema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(10).max(128),
  role: z.enum(["FAMILY", "PROVIDER"]), // ADMIN accounts are created only by the seed script
  acceptTerms: z.literal(true),
});
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ip = clientIp(req);
  if (rateLimited("reg:" + ip, 10)) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Check your details: password needs 10+ characters and you must accept the terms." }, { status: 400 });
  const { name, email, password, role } = p.data;
  if (await prisma.user.findUnique({ where: { email } }))
    return NextResponse.json({ error: "We could not create this account. Try logging in instead." }, { status: 409 });
  const user = await prisma.user.create({
    data: {
      name, email, role, passwordHash: await bcrypt.hash(password, 12),
      terms: { create: ["terms", "privacy"].map((document) => ({ document, version: TERMS_VERSION, ip })) },
      ...(role === "FAMILY" ? { family: { create: {} } } : {}),
    },
  });
  await createSession(user.id, req.headers.get("user-agent"));
  return NextResponse.json({ redirect: homeFor(user.role) });
}
