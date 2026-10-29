import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dateOr, fmt, oneOf, PAGE, pageOf, requireAdmin } from "@/lib/admin";
import { assignProvider, confirmOrFlagBooking, rescheduleBooking } from "@/app/admin/actions";
import { KIND, STATUSES } from "@/lib/booking";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { Badge, btn, card, Empty, Flash, H, inp, Pager } from "@/components/admin/ui";
type SP = Record<string, string | undefined>;
const TYPES = ["CLEANING", "DOCTOR_VISIT", "CHEF", "MEDICATION_PICKUP"] as const;
export default async function Page({ searchParams: sp }: { searchParams: SP }) {
  await requireAdmin();
  const page = pageOf(sp), q = sp.q?.trim(), st = oneOf(sp.status, STATUSES), ty = oneOf(sp.type, TYPES), from = dateOr(sp.from), to = dateOr(sp.to);
  const where: Prisma.ServiceWhereInput = { ...(st ? { status: st } : {}), ...(ty ? { type: ty } : {}), ...(from || to ? { scheduledAt: { gte: from, lte: to } } : {}),
    ...(q ? { OR: [{ recipient: { fullName: { contains: q, mode: "insensitive" } } }, { recipient: { owner: { email: { contains: q, mode: "insensitive" } } } }] } : {}),
    ...(sp.p ? { assignments: { some: { provider: { displayName: { contains: sp.p, mode: "insensitive" } } } } } : {}) };
  const [total, rows, provs] = await Promise.all([prisma.service.count({ where }),
    prisma.service.findMany({ where, orderBy: { scheduledAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { recipient: { select: { fullName: true, city: true, owner: { select: { email: true } } } },
      assignments: { include: { provider: { select: { displayName: true } } } }, evidence: { select: { id: true, kind: true, mimeType: true, sizeBytes: true, createdAt: true } }, review: { select: { rating: true } } } }),
    prisma.provider.findMany({ where: { status: "VERIFIED", available: true }, select: { id: true, displayName: true, kind: true } })]);
  const now = new Date();
  return (<>
    <H>Bookings & Visits</H><Flash sp={sp} />
    <form className="mb-4 flex flex-wrap gap-2" role="search"><input name="q" defaultValue={q} placeholder="Customer or loved one" aria-label="Customer" className={inp} /><input name="p" defaultValue={sp.p} placeholder="Provider" aria-label="Provider" className={inp} />
      <select name="status" defaultValue={st ?? ""} aria-label="Status" className={inp}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
      <select name="type" defaultValue={ty ?? ""} aria-label="Service" className={inp}><option value="">All services</option>{TYPES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
      <input type="date" name="from" defaultValue={sp.from} aria-label="From" className={inp} /><input type="date" name="to" defaultValue={sp.to} aria-label="To" className={inp} /><button className={btn}>Filter</button></form>
    {!rows.length ? <Empty text="No bookings match." /> : <div className="space-y-3">{rows.map((s) => { const late = s.scheduledAt < now && ["PENDING", "CONFIRMED", "ASSIGNED"].includes(s.status); const cur = s.assignments.find((a) => ["OFFERED", "ACCEPTED", "COMPLETED"].includes(a.status)); return (
      <details key={s.id} className={card}>
        <summary className="flex min-h-[44px] cursor-pointer flex-wrap items-center gap-3"><b>{s.type.replace("_", " ")}</b><span className="text-sm">{fmt(s.scheduledAt)}</span><span className="text-sm text-[#55667a]">{s.recipient.fullName}, {s.recipient.city}</span><Badge s={s.status} />{late && <Badge s="OVERDUE" />}</summary>
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          <div><p>Customer: {s.recipient.owner.email}</p><p>Provider: {cur?.provider.displayName ?? "Not assigned"}</p>{s.review && <p>Family rating: {s.review.rating}/5</p>}{s.familyNote && <p>Visit report: {s.familyNote}</p>}</div>
          <div><p className="font-semibold">Assignment history</p>{s.assignments.length ? s.assignments.map((a) => <p key={a.id}>{a.provider.displayName} · <Badge s={a.status} /></p>) : <p className="text-[#55667a]">None.</p>}
            <p className="mt-2 font-semibold">Evidence</p>{s.evidence.length ? s.evidence.map((e) => <p key={e.id}>{e.kind.replace("_", " ").toLowerCase()} · {e.mimeType} · {Math.round(e.sizeBytes / 1024)} KB · {fmt(e.createdAt)}</p>) : <p className="text-[#55667a]">No evidence uploaded.</p>}
            {s.evidence.length > 0 && <p className="text-xs text-[#55667a]">Viewing files needs private storage with signed links (not connected yet).</p>}</div></div>
        <div className="mt-4 space-y-2 border-t border-[#e6dfd0] pt-4">
          {s.status === "PENDING" && <form action={confirmOrFlagBooking}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="to" value="CONFIRMED" /><button className={btn}>Confirm booking</button></form>}
          {["CONFIRMED", "ASSIGNED", "ISSUE_REPORTED"].includes(s.status) && <form action={assignProvider} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={s.id} />
            <select name="providerId" required aria-label="Provider" className={inp}><option value="">Choose a provider…</option>{provs.filter((p) => p.kind === KIND[s.type]).map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}</select><ConfirmButton label={cur ? "Reassign" : "Assign"} message="Assign this provider? They will be asked to accept." /></form>}
          {["PENDING", "CONFIRMED", "ASSIGNED", "ISSUE_REPORTED"].includes(s.status) && <form action={rescheduleBooking} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={s.id} /><input type="datetime-local" name="when" required aria-label="New date and time" className={inp} /><ConfirmButton label="Reschedule" message="Move this booking to the new time?" /></form>}
          {NEXT_OK(s.status) && <form action={confirmOrFlagBooking} className="flex flex-wrap gap-2"><input type="hidden" name="id" value={s.id} /><select name="to" aria-label="Action" className={inp}><option value="ISSUE_REPORTED">Flag an issue</option><option value="CANCELLED">Cancel booking</option></select>
            <input name="reason" required maxLength={500} placeholder="Reason" aria-label="Reason" className={`${inp} flex-1`} /><ConfirmButton danger label="Apply" message="Apply this change? It is recorded in the audit log." /></form>}
        </div></details>); })}</div>}
    <Pager page={page} total={total} sp={sp} base="/admin/bookings" /></>);
}
const NEXT_OK = (s: string) => !["COMPLETED", "CANCELLED"].includes(s);
