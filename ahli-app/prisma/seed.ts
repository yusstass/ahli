import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
async function main() {
  if (!(await db.pricingConfiguration.count()))
    await db.pricingConfiguration.create({ data: { platformFeeBps: 700, contingencyBps: 800, unitCosts: { clean: 30, doc: 70, chef: 45 } } });
  const plans = [
    { key: "essential", name: "Essential", doctorVisits: 2, cleaningVisits: 4, chefVisits: 0, medAllowance: 0, priorityReserve: 0, coordinationCost: 30 },
    { key: "care", name: "Care+", doctorVisits: 4, cleaningVisits: 8, chefVisits: 0, medAllowance: 150, priorityReserve: 0, coordinationCost: 50 },
    { key: "complete", name: "Complete", doctorVisits: 4, cleaningVisits: 8, chefVisits: 8, medAllowance: 200, priorityReserve: 120, coordinationCost: 100 },
  ];
  for (const p of plans) await db.plan.upsert({ where: { key: p.key }, update: p, create: p });
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: pw } = process.env;
  if (email && pw && pw.length >= 12)
    await db.user.upsert({ where: { email }, update: {}, create: { email, name: "AHLI Admin", role: "ADMIN", passwordHash: await bcrypt.hash(pw, 12) } });
  else console.log("Set ADMIN_EMAIL and ADMIN_PASSWORD (12+ chars) in .env to create the first admin.");
}
main().finally(() => db.$disconnect());
