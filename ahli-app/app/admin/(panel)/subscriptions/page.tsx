import { prisma } from "@/lib/db";
import { fmt, oneOf, PAGE, pageOf, requireAdmin, tnd } from "@/lib/admin";
import { price } from "@/lib/pricing";
import { Badge, btn, card, Empty, H, inp, Pager } from "@/components/admin/ui";
type SP = Record<string, string | undefined>;
const ST = ["PENDING_PAYMENT", "ACTIVE", "PAUSED", "CANCELLED"] as const;
export default async function Page({ searchParams: sp }: { searchParams: SP }) {
  await requireAdmin();
  const page = pageOf(sp), st = oneOf(sp.status, ST), where = st ? { status: st } : {};
  const [cfg, plans, total, rows] = await Promise.all([prisma.pricingConfiguration.findFirst({ orderBy: { effectiveFrom: "desc" } }), prisma.plan.findMany({ orderBy: { coordinationCost: "asc" } }), prisma.subscription.count({ where }),
    prisma.subscription.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { user: { select: { email: true } }, plan: true, recipient: { select: { fullName: true } }, payments: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 } } })]);
  const c = cfg ? { platformFeeBps: cfg.platformFeeBps, contingencyBps: cfg.contingencyBps, unitCosts: cfg.unitCosts as { clean: number; doc: number; chef: number } } : null;
  return (<>
    <H>Subscriptions</H>
    <section className="mb-6 grid gap-4 md:grid-cols-3">{plans.map((p) => <div key={p.id} className={card}><h2 className="font-serif text-xl">{p.name}</h2><p className="font-serif text-2xl">{c ? tnd(price(p, c).total) + " / month" : "No pricing configured"}</p>
      <p className="text-sm text-[#55667a]">{p.doctorVisits} doctor visits · {p.cleaningVisits} cleaning visits{p.chefVisits ? ` · ${p.chefVisits} chef visits` : ""}{Number(p.medAllowance) ? ` · medication allowance ${tnd(p.medAllowance)}` : ""}{Number(p.priorityReserve) ? " · priority consultation" : ""}</p></div>)}</section>
    <form className="mb-4 flex gap-2"><select name="status" defaultValue={st ?? ""} aria-label="Status" className={inp}><option value="">All statuses</option>{ST.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select><button className={btn}>Filter</button></form>
    {!rows.length ? <Empty text="No subscriptions yet." /> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-[#e6dfd0]"><th className="p-2">Customer</th><th className="p-2">Loved one</th><th className="p-2">Plan</th><th className="p-2">Price agreed</th><th className="p-2">Status</th><th className="p-2">Latest payment</th><th className="p-2">Started</th></tr></thead>
      <tbody>{rows.map((s) => <tr key={s.id} className="border-b border-[#e6dfd0]"><td className="p-2">{s.user.email}</td><td className="p-2">{s.recipient.fullName}</td><td className="p-2">{s.plan.name}</td><td className="p-2">{tnd(s.priceSnapshot)}</td><td className="p-2"><Badge s={s.status} /></td><td className="p-2">{s.payments[0] ? <Badge s={s.payments[0].status} /> : "—"}</td><td className="p-2">{fmt(s.startsAt)}</td></tr>)}</tbody></table></div>}
    <Pager page={page} total={total} sp={sp} base="/admin/subscriptions" /></>);
}
