import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fmt, oneOf, PAGE, pageOf, requireAdmin } from "@/lib/admin";
import { requestProviderInfo, reviewDocument, setAvailability, setProviderStatus } from "@/app/admin/actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { Badge, btn, card, Empty, Flash, H, inp, Pager } from "@/components/admin/ui";
type SP = Record<string, string | undefined>;
const ST = ["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED"] as const;
const NEXT: Record<string, string[]> = { PENDING: ["UNDER_REVIEW", "REJECTED"], UNDER_REVIEW: ["VERIFIED", "REJECTED"], VERIFIED: ["SUSPENDED"], SUSPENDED: ["VERIFIED", "UNDER_REVIEW"], REJECTED: ["UNDER_REVIEW"] };
export default async function Page({ searchParams: sp }: { searchParams: SP }) {
  await requireAdmin();
  const page = pageOf(sp), q = sp.q?.trim(), st = oneOf(sp.status, ST);
  const where: Prisma.ProviderWhereInput = { ...(st ? { status: st } : {}), ...(q ? { OR: [{ displayName: { contains: q, mode: "insensitive" } }, { user: { email: { contains: q, mode: "insensitive" } } }] } : {}) };
  const [total, rows] = await Promise.all([prisma.provider.count({ where }), prisma.provider.findMany({ where, orderBy: { id: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { user: { select: { email: true } }, verifications: true, events: { orderBy: { createdAt: "desc" }, take: 8 }, assignments: { take: 5, orderBy: { service: { scheduledAt: "desc" } }, include: { service: { select: { type: true, status: true, scheduledAt: true } } } } } })]);
  const ids = rows.map((r) => r.id);
  const reviews = await prisma.review.findMany({ where: { service: { assignments: { some: { providerId: { in: ids }, status: "COMPLETED" } } } }, select: { rating: true, service: { select: { assignments: { where: { status: "COMPLETED" }, select: { providerId: true } } } } } });
  const rate = (id: string) => { const r = reviews.filter((x) => x.service.assignments.some((a) => a.providerId === id)); return r.length ? `${(r.reduce((s, x) => s + x.rating, 0) / r.length).toFixed(1)} (${r.length} reviews)` : "No reviews yet"; };
  return (<>
    <H>Care Providers</H><Flash sp={sp} />
    <p className="mb-4 text-sm text-[#55667a]">A provider can only be set to Verified after an admin approves their identity and profession documents. Document files open from private storage once it is connected.</p>
    <form className="mb-4 flex flex-wrap gap-2" role="search"><input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search" className={inp} />
      <select name="status" defaultValue={st ?? ""} aria-label="Status" className={inp}><option value="">All statuses</option>{ST.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select><button className={btn}>Filter</button></form>
    {!rows.length ? <Empty text="No providers match. Providers appear here after they register." /> : <div className="space-y-3">{rows.map((p) => (
      <details key={p.id} className={card}>
        <summary className="flex min-h-[44px] cursor-pointer flex-wrap items-center gap-3"><b>{p.displayName}</b><span className="text-sm text-[#55667a]">{p.kind.replace("_", " ").toLowerCase()} · {p.user.email}</span><Badge s={p.status} />{!p.available && <Badge s="UNAVAILABLE" />}</summary>
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
          <div><p className="font-semibold">Documents</p>{p.verifications.length ? p.verifications.map((v) => (
            <form key={v.id} action={reviewDocument} className="flex flex-wrap items-center gap-2 py-1"><input type="hidden" name="id" value={v.id} /><span>{v.kind.toLowerCase()}</span><Badge s={v.status} />
              {v.status !== "APPROVED" && <button name="to" value="APPROVED" className="font-semibold text-[#0f7a79] underline">Approve</button>}{v.status !== "REJECTED" && <button name="to" value="REJECTED" className="font-semibold text-[#b3261e] underline">Reject</button>}</form>)) : <p className="text-[#55667a]">No documents submitted.</p>}
            <p className="mt-3 font-semibold">Rating</p><p>{rate(p.id)}</p></div>
          <div><p className="font-semibold">Verification history</p>{p.events.length ? p.events.map((e) => <p key={e.id}>{fmt(e.createdAt)}: {e.fromStatus ?? "—"} → {e.toStatus.replace("_", " ")}{e.reason ? ` (${e.reason})` : ""}</p>) : <p className="text-[#55667a]">No changes yet.</p>}
            <p className="mt-3 font-semibold">Assignments</p>{p.assignments.length ? p.assignments.map((a) => <p key={a.id}>{fmt(a.service.scheduledAt)} · {a.service.type.replace("_", " ").toLowerCase()} · <Badge s={a.status} /></p>) : <p className="text-[#55667a]">None.</p>}</div></div>
        <form action={setProviderStatus} className="mt-4 flex flex-wrap gap-2 border-t border-[#e6dfd0] pt-4"><input type="hidden" name="id" value={p.id} />
          <select name="to" aria-label="New status" className={inp}>{NEXT[p.status].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select>
          <input name="reason" maxLength={500} placeholder="Reason (required to reject or suspend)" aria-label="Reason" className={`${inp} flex-1`} /><ConfirmButton label="Change status" message="Change this provider's status? The provider is notified." /></form>
        <form action={requestProviderInfo} className="mt-2 flex gap-2"><input type="hidden" name="id" value={p.id} /><input name="message" required maxLength={500} placeholder="Ask for more information" aria-label="Request" className={`${inp} flex-1`} /><button className={btn}>Send request</button></form>
        <form action={setAvailability} className="mt-2 flex flex-wrap items-center gap-2"><input type="hidden" name="id" value={p.id} /><select name="available" defaultValue={p.available ? "1" : "0"} aria-label="Availability" className={inp}><option value="1">Available</option><option value="0">Unavailable</option></select>
          <input name="categories" defaultValue={p.categories.join(", ")} placeholder="Service categories, comma separated" aria-label="Categories" className={`${inp} flex-1`} /><button className={btn}>Save</button></form>
      </details>))}</div>}
    <Pager page={page} total={total} sp={sp} base="/admin/providers" /></>);
}
