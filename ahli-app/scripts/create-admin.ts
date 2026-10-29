// Run on the server only:  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long unique password' npx tsx scripts/create-admin.ts
// This is the ONLY way to create an administrator. There is no public registration for admins.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(), pw = process.env.ADMIN_PASSWORD;
  if (!email || !pw || pw.length < 12) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ characters).");
  if (await db.user.findUnique({ where: { email } })) throw new Error("That email already has an account. Choose another one; existing users are never promoted automatically.");
  const u = await db.user.create({ data: { email, name: "AHLI Admin", role: "ADMIN", emailVerifiedAt: new Date(), passwordHash: await bcrypt.hash(pw, 12) } });
  await db.auditLog.create({ data: { actorId: "system", action: "admin.created", entity: "User", entityId: u.id } });
  console.log("Administrator created:", email);
}
main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => db.$disconnect());
