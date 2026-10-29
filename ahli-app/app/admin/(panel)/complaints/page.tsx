import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dateOr, fmt, oneOf, PAGE, pageOf, requireAdmin } from "@/lib/admin";
import { addTicketNote, updateTicket } from "@/app/admin/actions";
import { Badge, btn, card, Empty, Flash, H, inp, Pager } from "@/components/admin/ui";
type SP = Record<string, string | undefined>;
const ST = ["OPEN", "IN_REVIEW", "WAITING_INFO", "RESOLVED", "CLOSED"] as const, SV = ["LOW", "MEDIUM", "HIGH"] as const;
export default async function Page({ searchParams: sp }: { searchParams: SP }) {
  await requireAdmin();
  const page = pageOf(sp), st = oneOf(sp.status, ST), sv = oneOf(sp.severity, SV), from = dateOr(sp.from), to = dateOr(sp.to);
  const where: Prisma.SupportTicketWhereInput = { ...(st ? { status: st } : {}), ...(sv ? { severity: sv } : {}), ...(from || to ? { createdAt: { gte: from, lte: to } } : {}) };
  const [total, rows, admins] = await Promise.all([prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { user: { select: { email: true, name: true } }, notes: { orderBy: { createdAt: "desc" } } } }),
    prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, email: true } })]);
  return (<>
    <H>Complaints & Reports</H><Flash sp={sp} />
    <p className="mb-4 text-sm text-[#55667a]">Cases appear here when customers submit them. Keep medical detail out of notes; link to the visit instead.</p>
    <form className="mb-4 flex flex-wrap gap-2"><select name="status" defaultValue={st ?? ""} aria-label="Status" className={inp}><option value="">All statuses</option>{ST.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
      <select name="severity" defaultValue={sv ?? ""} aria-label="Severity" className={inp}><option value="">Any severity</option>{SV.map((s) => <option key={s}>{s}</option>)}</select>
      <input type="date" name="from" defaultValue={sp.from} aria-label="From" className={inp} /><input type="date" name="to" defaultValue={sp.to} aria-label="To" className={inp} /><button className={btn}>Filter</button></form>
    {!rows.length ? <Empty text="No cases match." /> : <div className="space-y-3">{rows.map((t) => (
      <details key={t.id} className={card}>
        <summary className="flex min-h-[44px] cursor-pointer flex-wrap items-center gap-3"><b>{t.subject}</b><Badge s={t.status} /><Badge s={t.severity} /><span className="text-sm text-[#55667a]">{t.user.email} · {fmt(t.createdAt)}</span></summary>
        <p className="mt-3 text-sm">{t.body}</p>
        <p className="mt-2 text-sm text-[#55667a]">Assigned to: {admins.find((a) => a.id === t.assignedToId)?.email ?? "nobody"}{t.serviceId ? ` · linked visit ${t.serviceId}` : ""}</p>
        {t.resolution && <p className="mt-2 text-sm">Resolution: {t.resolution}</p>}
        <p className="mt-3 font-semibold">Internal notes</p>{t.notes.map((n) => <p key={n.id} className="text-sm">{fmt(n.createdAt)} · {admins.find((a) => a.id === n.authorId)?.email ?? "admin"}: {n.body}</p>)}
        <form action={addTicketNote} className="mt-2 flex gap-2"><input type="hidden" name="id" value={t.id} /><input name="body" required maxLength={1000} placeholder="Add an internal note" aria-label="Note" className={`${inp} flex-1`} /><button className={btn}>Save</button></form>
        <form action={updateTicket} className="mt-3 flex flex-wrap gap-2 border-t border-[#e6dfd0] pt-3"><input type="hidden" name="id" value={t.id} />
          <select name="status" defaultValue={t.status} aria-label="Status" className={inp}>{ST.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
          <select name="assign" aria-label="Assignment" className={inp}><option value="">Keep assignee</option><option value="me">Assign to me</option></select>
          <input name="resolution" maxLength={1000} placeholder="Resolution (required to resolve or close)" aria-label="Resolution" className={`${inp} flex-1`} /><button className={btn}>Update case</button></form>
      </details>))}</div>}
    <Pager page={page} total={total} sp={sp} base="/admin/complaints" /></>);
}
