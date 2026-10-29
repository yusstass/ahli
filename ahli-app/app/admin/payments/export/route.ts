import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit, csvCell, dateOr, oneOf, requireAdmin } from "@/lib/admin";
export async function GET(req: NextRequest) {
  const s = await requireAdmin();
  const q = req.nextUrl.searchParams, st = oneOf(q.get("status") ?? undefined, ["PENDING", "VERIFIED", "FAILED", "REFUNDED"] as const), from = dateOr(q.get("from") ?? undefined), to = dateOr(q.get("to") ?? undefined);
  const where: Prisma.PaymentWhereInput = { ...(st ? { status: st } : {}), ...(from || to ? { createdAt: { gte: from, lte: to } } : {}) };
  const rows = await prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, take: 5000, include: { user: { select: { email: true } }, subscription: { include: { plan: true } } } });
  const csv = [["date", "reference", "customer", "plan", "amount_tnd", "method", "status"].join(","),
    ...rows.map((p) => [p.createdAt.toISOString(), p.reference, p.user.email, p.subscription.plan.name, Number(p.amount), p.provider, p.status].map(csvCell).join(","))].join("\n");
  await audit(s.user.id, "payments.exported", "Payment", "csv", { rows: rows.length });
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="ahli-payments.csv"', "Cache-Control": "no-store" } });
}
