import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dateOr, fmt, oneOf, PAGE, pageOf, requireAdmin, tnd } from "@/lib/admin";
import { markPayoutPaid, reviewPayment } from "@/app/admin/actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { Badge, btn, card, Empty, Flash, H, inp, Pager, Stat } from "@/components/admin/ui";
type SP = Record<string, string | undefined>;
const ST = ["PENDING", "VERIFIED", "FAILED", "REFUNDED"] as const;
export default async function Page({ searchParams: sp }: { searchParams: SP }) {
  await requireAdmin();
  const page = pageOf(sp), st = oneOf(sp.status, ST), from = dateOr(sp.from), to = dateOr(sp.to);
  const where: Prisma.PaymentWhereInput = { ...(st ? { status: st } : {}), ...(from || to ? { createdAt: { gte: from, lte: to } } : {}) };
  const [total, rows, payouts, sums] = await Promise.all([prisma.payment.count({ where }),
    prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { user: { select: { email: true } }, subscription: { include: { plan: true } } } }),
    prisma.providerPayout.findMany({ orderBy: [{ status: "asc" }, { id: "desc" }], take: 20, include: { provider: { select: { displayName: true } } } }),
    prisma.providerPayout.groupBy({ by: ["status"], _sum: { amount: true, platformFee: true } })]);
  const exp = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && ["status", "from", "to"].includes(k)) as [string, string][]).toString();
  const owed = sums.find((s) => s.status === "PENDING")?._sum.amount ?? 0, fees = sums.reduce((a, s) => a + Number(s._sum.platformFee ?? 0), 0);
  return (<>
    <H>Payments & Payouts</H><Flash sp={sp} />
    <p className="mb-4 text-sm text-[#55667a]">Only bank transfers can be reviewed by hand. A payment counts as paid only after you verify it here (or a payment provider confirms it).</p>
    <form className="mb-4 flex flex-wrap gap-2"><select name="status" defaultValue={st ?? ""} aria-label="Status" className={inp}><option value="">All statuses</option>{ST.map((s) => <option key={s}>{s}</option>)}</select>
      <input type="date" name="from" defaultValue={sp.from} aria-label="From" className={inp} /><input type="date" name="to" defaultValue={sp.to} aria-label="To" className={inp} /><button className={btn}>Filter</button>
      <a className="flex min-h-[40px] items-center rounded-full border border-[#12263F] px-4 text-sm font-semibold" href={`/admin/payments/export?${exp}`}>Export CSV</a></form>
    {!rows.length ? <Empty text="No payments recorded yet." /> : <div className="space-y-3">{rows.map((p) => (
      <div key={p.id} className={`${card} flex flex-wrap items-center gap-3 text-sm`}>
        <b>{tnd(p.amount)}</b><Badge s={p.status} /><span>{p.provider.replace("_", " ").toLowerCase()}</span><span className="font-mono">{p.reference}</span><span>{p.user.email}</span><span>{p.subscription.plan.name}</span><span className="text-[#55667a]">{fmt(p.createdAt)}</span>
        <form action={reviewPayment} className="ml-auto flex gap-2"><input type="hidden" name="id" value={p.id} />
          {p.status === "PENDING" && p.provider === "BANK_TRANSFER" && <><button name="to" value="VERIFIED" className={btn}>Verify transfer</button><button name="to" value="FAILED" className="min-h-[40px] rounded-full border border-[#b3261e] px-4 font-semibold text-[#b3261e]">Reject</button></>}</form>
        {p.status === "VERIFIED" && <form action={reviewPayment}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="to" value="REFUNDED" /><ConfirmButton danger label="Mark refunded" message="Mark as refunded? The subscription is cancelled. You must send the money back yourself." /></form>}
      </div>))}</div>}
    <Pager page={page} total={total} sp={sp} base="/admin/payments" />
    <h2 className="mb-3 mt-8 font-serif text-2xl">Provider payouts</h2>
    <div className="mb-4 grid gap-4 sm:grid-cols-2"><Stat label="Owed to providers" value={tnd(owed)} /><Stat label="AHLI fees on recorded payouts" value={tnd(fees)} /></div>
    {!payouts.length ? <Empty text="No payouts recorded yet. They are created when providers complete jobs." /> : payouts.map((o) => (
      <div key={o.id} className={`${card} mb-2 flex flex-wrap items-center gap-3 text-sm`}><b>{o.provider.displayName}</b><span>{tnd(o.amount)} (fee {tnd(o.platformFee)})</span><Badge s={o.status} /><span>{fmt(o.paidAt)}</span>
        {o.status === "PENDING" && <form action={markPayoutPaid} className="ml-auto"><input type="hidden" name="id" value={o.id} /><ConfirmButton label="Mark paid" message="Confirm you have paid this provider?" /></form>}</div>))}</>);
}
