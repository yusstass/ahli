import { prisma } from "@/lib/db";
import { requireAdmin, tnd } from "@/lib/admin";
import { Bars, H, Stat, card } from "@/components/admin/ui";
export default async function Page() {
  await requireAdmin();
  const som = new Date(); som.setDate(1); som.setHours(0, 0, 0, 0);
  const since = new Date(som); since.setMonth(since.getMonth() - 5);
  const cnt = (s: "PENDING" | "COMPLETED" | "CANCELLED" | "ISSUE_REPORTED") => prisma.service.count({ where: { status: s } });
  const [customers, providers, subs, pending, done, cancelled, issues, tickets, rev, bm, rm, dist, plans] = await Promise.all([
    prisma.user.count({ where: { role: "FAMILY" } }), prisma.provider.count({ where: { status: "VERIFIED" } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }), cnt("PENDING"), cnt("COMPLETED"), cnt("CANCELLED"), cnt("ISSUE_REPORTED"),
    prisma.supportTicket.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "VERIFIED", verifiedAt: { gte: som } } }),
    prisma.$queryRaw<{ m: string; n: number }[]>`SELECT to_char(date_trunc('month',"scheduledAt"),'YYYY-MM') AS m, count(*)::int AS n FROM "Service" WHERE "scheduledAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ m: string; s: number }[]>`SELECT to_char(date_trunc('month',"verifiedAt"),'YYYY-MM') AS m, sum(amount)::float8 AS s FROM "Payment" WHERE status = 'VERIFIED' AND "verifiedAt" >= ${since} GROUP BY 1 ORDER BY 1`,
    prisma.subscription.groupBy({ by: ["planId"], where: { status: "ACTIVE" }, _count: { _all: true } }), prisma.plan.findMany(),
  ]);
  const name = (id: string) => plans.find((p) => p.id === id)?.name ?? "Unknown";
  return (<>
    <H>Overview</H>
    <p className="mb-4 text-sm text-[#55667a]">All figures are live counts from the database. Revenue counts verified payments only.</p>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Customers" value={customers} /><Stat label="Verified providers" value={providers} /><Stat label="Active subscriptions" value={subs} />
      <Stat label="Revenue this month" value={tnd(rev._sum.amount ?? 0)} hint="Verified payments" />
      <Stat label="Pending bookings" value={pending} /><Stat label="Completed visits" value={done} /><Stat label="Cancelled bookings" value={cancelled} />
      <Stat label="Problems and open complaints" value={issues + tickets} hint={`${issues} visits flagged · ${tickets} open cases`} />
    </div>
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <section className={card}><h2 className="mb-3 font-serif text-xl">Bookings per month</h2><Bars label="Bookings per month, last 6 months" data={bm.map((r) => ({ k: r.m, v: r.n }))} /></section>
      <section className={card}><h2 className="mb-3 font-serif text-xl">Verified revenue per month (TND)</h2><Bars label="Verified revenue per month" data={rm.map((r) => ({ k: r.m, v: Math.round(r.s) }))} /></section>
      <section className={card}><h2 className="mb-3 font-serif text-xl">Active subscriptions by plan</h2><Bars label="Active subscriptions by plan" data={dist.map((d) => ({ k: name(d.planId), v: d._count._all }))} /></section>
    </div></>);
}
