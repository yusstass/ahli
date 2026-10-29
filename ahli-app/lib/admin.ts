import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getSession } from "./session";

// Call at the top of EVERY admin page, route handler and server action. Layouts are not re-run on client navigation.
export async function requireAdmin() {
  const s = await getSession();
  if (!s) redirect("/admin/login");
  if (s.user.role !== "ADMIN") notFound(); // do not reveal that an admin area exists
  return s;
}
export class UserError extends Error {}
export async function audit(actorId: string, action: string, entity: string, entityId: string, meta?: Record<string, unknown>) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId, meta: meta as Prisma.InputJsonValue, ip: headers().get("x-forwarded-for")?.split(",")[0].trim() ?? null } });
}
export const PAGE = 20;
export const pageOf = (sp: { page?: string }) => Math.max(1, parseInt(sp.page ?? "1") || 1);
export const tnd = (n: unknown) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 3 }) + " TND";
export const fmt = (d?: Date | null) => (d ? d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Tunis" }) : "—");
export const dateOr = (v?: string) => { const d = v ? new Date(v) : undefined; return d && !isNaN(+d) ? d : undefined; };
export const oneOf = <T extends string>(v: string | undefined, all: readonly T[]) => (all as readonly string[]).includes(v ?? "") ? (v as T) : undefined;
export const csvCell = (v: unknown) => { const s = String(v ?? ""); return '"' + (/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"'; }; // blocks spreadsheet formula injection
