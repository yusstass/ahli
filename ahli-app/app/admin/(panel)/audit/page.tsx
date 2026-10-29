import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fmt, PAGE, pageOf, requireAdmin } from "@/lib/admin";
import { btn, Empty, H, inp, Pager } from "@/components/admin/ui";
export default async function Page({ searchParams: sp }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin();
  const page = pageOf(sp), q = sp.q?.trim(), where: Prisma.AuditLogWhereInput = q ? { action: { contains: q, mode: "insensitive" } } : {};
  const [total, rows, admins] = await Promise.all([prisma.auditLog.count({ where }), prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }), prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, email: true } })]);
  return (<>
    <H>Audit Logs</H>
    <form className="mb-4 flex gap-2" role="search"><input name="q" defaultValue={q} placeholder="Filter by action, e.g. payment" aria-label="Action" className={inp} /><button className={btn}>Filter</button></form>
    {!rows.length ? <Empty text="No activity recorded yet." /> : <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-[#e6dfd0]"><th className="p-2">When</th><th className="p-2">Admin</th><th className="p-2">Action</th><th className="p-2">Record</th><th className="p-2">Details</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id} className="border-b border-[#e6dfd0] align-top"><td className="p-2">{fmt(r.createdAt)}</td><td className="p-2">{admins.find((a) => a.id === r.actorId)?.email ?? r.actorId}</td><td className="p-2 font-mono">{r.action}</td><td className="p-2">{r.entity} {r.entityId.slice(0, 8)}</td><td className="p-2 text-xs">{r.meta ? JSON.stringify(r.meta) : ""}</td></tr>)}</tbody></table></div>}
    <Pager page={page} total={total} sp={sp} base="/admin/audit" /></>);
}
