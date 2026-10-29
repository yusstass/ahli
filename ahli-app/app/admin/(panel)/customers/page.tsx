import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fmt, PAGE, pageOf, requireAdmin } from "@/lib/admin";
import { addCustomerNote, setAccountStatus } from "@/app/admin/actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { Badge, card, Empty, Flash, H, inp, btn, Pager } from "@/components/admin/ui";
type SP = Record<string, string | undefined>;
export default async function Page({ searchParams: sp }: { searchParams: SP }) {
  await requireAdmin();
  const page = pageOf(sp), q = sp.q?.trim();
  const where: Prisma.UserWhereInput = { role: "FAMILY",
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    ...(sp.status === "suspended" ? { disabledAt: { not: null } } : sp.status === "active" ? { disabledAt: null } : {}),
    ...(sp.plan ? { subscriptions: { some: { plan: { key: sp.plan }, status: "ACTIVE" } } } : {}) };
  const [total, rows, plans] = await Promise.all([prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: {
      subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 5 }, recipients: { select: { fullName: true, city: true } },
      customerNotes: { orderBy: { createdAt: "desc" }, take: 5 }, tickets: { select: { id: true, subject: true, status: true }, take: 5, orderBy: { createdAt: "desc" } } } }),
    prisma.plan.findMany()]);
  const svc = await prisma.service.findMany({ where: { recipient: { ownerId: { in: rows.map((r) => r.id) } } }, orderBy: { scheduledAt: "desc" }, take: 200, select: { type: true, status: true, scheduledAt: true, recipient: { select: { ownerId: true } } } });
  return (<>
    <H>Customers</H><Flash sp={sp} />
    <form className="mb-4 flex flex-wrap gap-2" role="search">
      <input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search" className={inp} />
      <select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className={inp}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
      <select name="plan" defaultValue={sp.plan ?? ""} aria-label="Subscription" className={inp}><option value="">Any subscription</option>{plans.map((p) => <option key={p.id} value={p.key}>{p.name}</option>)}</select>
      <button className={btn}>Filter</button></form>
    {!rows.length ? <Empty text="No customers match." /> : <div className="space-y-3">{rows.map((u) => (
      <details key={u.id} className={card}>
        <summary className="flex min-h-[44px] cursor-pointer flex-wrap items-center gap-3"><b>{u.name}</b><span className="text-sm text-[#55667a]">{u.email}</span><Badge s="ACTIVE" disabled={!!u.disabledAt} />{u.subscriptions[0] && <Badge s={u.subscriptions[0].plan.name + " · " + u.subscriptions[0].status} />}</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm">
          <div><p className="font-semibold">Registered</p><p>{fmt(u.createdAt)}</p>
            <p className="mt-3 font-semibold">Loved ones</p>{u.recipients.length ? u.recipients.map((r, i) => <p key={i}>{r.fullName}, {r.city}</p>) : <p className="text-[#55667a]">None added.</p>}
            <p className="mt-3 font-semibold">Subscriptions</p>{u.subscriptions.length ? u.subscriptions.map((s) => <p key={s.id}>{s.plan.name} · <Badge s={s.status} /></p>) : <p className="text-[#55667a]">None.</p>}</div>
          <div><p className="font-semibold">Recent bookings</p>{svc.filter((s) => s.recipient.ownerId === u.id).slice(0, 5).map((s, i) => <p key={i}>{fmt(s.scheduledAt)} · {s.type.replace("_", " ").toLowerCase()} · <Badge s={s.status} /></p>)}
            <p className="mt-3 font-semibold">Reports and complaints</p>{u.tickets.length ? u.tickets.map((t) => <p key={t.id}>{t.subject} · <Badge s={t.status} /></p>) : <p className="text-[#55667a]">None.</p>}</div>
        </div>
        <p className="mt-4 font-semibold">Internal notes</p>{u.customerNotes.map((n) => <p key={n.id} className="text-sm">{fmt(n.createdAt)}: {n.body}</p>)}
        <form action={addCustomerNote} className="mt-2 flex gap-2"><input type="hidden" name="id" value={u.id} /><input name="body" required maxLength={1000} placeholder="Add a note" aria-label="Note" className={`${inp} flex-1`} /><button className={btn}>Save</button></form>
        <form action={setAccountStatus} className="mt-4 flex flex-wrap gap-2 border-t border-[#e6dfd0] pt-4"><input type="hidden" name="id" value={u.id} /><input type="hidden" name="to" value={u.disabledAt ? "reactivate" : "suspend"} />
          <input name="reason" required maxLength={500} placeholder="Reason (kept in the audit log)" aria-label="Reason" className={`${inp} flex-1`} />
          <ConfirmButton danger={!u.disabledAt} label={u.disabledAt ? "Reactivate" : "Suspend"} message={u.disabledAt ? "Reactivate this account?" : "Suspend this account? The customer is signed out immediately."} /></form>
      </details>))}</div>}
    <Pager page={page} total={total} sp={sp} base="/admin/customers" /></>);
}
