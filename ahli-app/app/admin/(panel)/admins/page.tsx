import { prisma } from "@/lib/db";
import { fmt, requireAdmin } from "@/lib/admin";
import { Badge, card, H } from "@/components/admin/ui";
export default async function Page() {
  await requireAdmin();
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, email: true, name: true, createdAt: true, disabledAt: true, sessions: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } } });
  return (<>
    <H>Admin Accounts & Roles</H>
    <p className="mb-4 text-sm text-[#55667a]">Administrators can only be created on the server with <code>scripts/create-admin.ts</code>. Nobody can grant themselves admin rights from the website. There is one admin role for now; finer roles (support, finance) are a later step.</p>
    <div className="space-y-2">{admins.map((a) => <div key={a.id} className={`${card} flex flex-wrap items-center gap-3 text-sm`}><b>{a.name}</b><span>{a.email}</span><Badge s="ACTIVE" disabled={!!a.disabledAt} /><span className="text-[#55667a]">Created {fmt(a.createdAt)} · last sign-in {fmt(a.sessions[0]?.createdAt)}</span></div>)}</div></>);
}
