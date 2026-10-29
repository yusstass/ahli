"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProviderStatus, TicketStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit, oneOf, requireAdmin, UserError } from "@/lib/admin";
import { canMove, KIND } from "@/lib/booking";

// Every action: re-checks the admin role, validates input, runs, logs, then redirects with a message.
async function run(back: string, fn: (me: string) => Promise<string>) {
  const s = await requireAdmin();
  let key = "msg", text: string;
  try { text = await fn(s.user.id); }
  catch (e) { key = "err"; if (e instanceof UserError) text = e.message; else { console.error("admin action failed:", (e as Error).name); text = "Something went wrong. Nothing was changed."; } }
  revalidatePath(back);
  redirect(`${back}?${key}=${encodeURIComponent(text)}`);
}
const t = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const need = (v: string, m: string) => { if (!v) throw new UserError(m); return v; };
const notify = (userId: string, title: string, body: string) => prisma.notification.create({ data: { userId, title, body } });

// ---- Customers
export async function setAccountStatus(f: FormData) {
  await run("/admin/customers", async (me) => {
    const id = need(t(f, "id", 40), "Missing account."), to = oneOf(t(f, "to"), ["suspend", "reactivate"] as const), reason = need(t(f, "reason"), "A reason is required.");
    const u = await prisma.user.findUnique({ where: { id } });
    if (!u || u.role === "ADMIN" || !to) throw new UserError("Only customer or provider accounts can be changed here.");
    if (to === "suspend") await prisma.$transaction([prisma.user.update({ where: { id }, data: { disabledAt: new Date() } }), prisma.session.deleteMany({ where: { userId: id } })]);
    else await prisma.user.update({ where: { id }, data: { disabledAt: null } });
    await audit(me, "user." + to, "User", id, { reason });
    return to === "suspend" ? "Account suspended and signed out." : "Account reactivated.";
  });
}
export async function addCustomerNote(f: FormData) {
  await run("/admin/customers", async (me) => {
    const id = need(t(f, "id", 40), "Missing account."), body = need(t(f, "body", 1000), "Write a note first.");
    await prisma.customerNote.create({ data: { customerId: id, authorId: me, body } });
    await audit(me, "customer.note", "User", id);
    return "Note saved.";
  });
}

// ---- Providers
const PT: Record<ProviderStatus, ProviderStatus[]> = { PENDING: ["UNDER_REVIEW", "REJECTED"], UNDER_REVIEW: ["VERIFIED", "REJECTED"], VERIFIED: ["SUSPENDED"], SUSPENDED: ["VERIFIED", "UNDER_REVIEW"], REJECTED: ["UNDER_REVIEW"] };
const PS = ["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED", "SUSPENDED"] as const;
export async function setProviderStatus(f: FormData) {
  await run("/admin/providers", async (me) => {
    const id = need(t(f, "id", 40), "Missing provider."), to = oneOf(t(f, "to"), PS), reason = t(f, "reason");
    const p = await prisma.provider.findUnique({ where: { id }, include: { verifications: true } });
    if (!p || !to) throw new UserError("Provider not found.");
    if (!PT[p.status].includes(to)) throw new UserError(`A ${p.status.toLowerCase().replace("_", " ")} provider cannot move to ${to.toLowerCase().replace("_", " ")}.`);
    if ((to === "REJECTED" || to === "SUSPENDED") && !reason) throw new UserError("A reason is required.");
    if (to === "VERIFIED") {
      const ok = (k: string) => p.verifications.some((v) => v.kind === k && v.status === "APPROVED");
      if (!ok("IDENTITY") || !ok("PROFESSION")) throw new UserError("Approve the identity and profession documents before verifying this provider.");
    }
    await prisma.$transaction([prisma.provider.update({ where: { id }, data: { status: to } }), prisma.providerStatusEvent.create({ data: { providerId: id, fromStatus: p.status, toStatus: to, reason: reason || null, actorId: me } })]);
    await audit(me, "provider." + to.toLowerCase(), "Provider", id, { from: p.status, reason });
    await notify(p.userId, "Your AHLI provider status changed", `Your status is now ${to.replace("_", " ").toLowerCase()}.${reason ? " " + reason : ""}`);
    return "Provider status updated.";
  });
}
export async function reviewDocument(f: FormData) {
  await run("/admin/providers", async (me) => {
    const id = need(t(f, "id", 40), "Missing document."), to = oneOf(t(f, "to"), ["APPROVED", "REJECTED"] as const);
    if (!to) throw new UserError("Invalid decision.");
    await prisma.providerVerification.update({ where: { id }, data: { status: to, reviewedById: me, reviewedAt: new Date() } });
    await audit(me, "verification." + to.toLowerCase(), "ProviderVerification", id);
    return "Document reviewed.";
  });
}
export async function requestProviderInfo(f: FormData) {
  await run("/admin/providers", async (me) => {
    const id = need(t(f, "id", 40), "Missing provider."), msg = need(t(f, "message"), "Write what you need from the provider.");
    const p = await prisma.provider.findUnique({ where: { id } });
    if (!p) throw new UserError("Provider not found.");
    await prisma.providerStatusEvent.create({ data: { providerId: id, fromStatus: p.status, toStatus: p.status, reason: "Information requested: " + msg, actorId: me } });
    await notify(p.userId, "AHLI needs more information", msg);
    await audit(me, "provider.info_requested", "Provider", id);
    return "Request sent to the provider.";
  });
}
export async function setAvailability(f: FormData) {
  await run("/admin/providers", async (me) => {
    const id = need(t(f, "id", 40), "Missing provider."), available = t(f, "available") === "1";
    await prisma.provider.update({ where: { id }, data: { available, categories: t(f, "categories", 200).split(",").map((c) => c.trim()).filter(Boolean).slice(0, 10) } });
    await audit(me, "provider.availability", "Provider", id, { available });
    return "Availability saved.";
  });
}

// ---- Bookings (all state changes go through canMove)
export async function confirmOrFlagBooking(f: FormData) {
  await run("/admin/bookings", async (me) => {
    const id = need(t(f, "id", 40), "Missing booking."), to = oneOf(t(f, "to"), ["CONFIRMED", "ISSUE_REPORTED", "CANCELLED"] as const), reason = t(f, "reason");
    const s = await prisma.service.findUnique({ where: { id } });
    if (!s || !to) throw new UserError("Booking not found.");
    if (!canMove(s.status, to)) throw new UserError(`A ${s.status.toLowerCase().replace("_", " ")} booking cannot become ${to.toLowerCase().replace("_", " ")}.`);
    if (to !== "CONFIRMED" && !reason) throw new UserError("A reason is required.");
    await prisma.$transaction([
      prisma.service.update({ where: { id }, data: { status: to } }),
      ...(to === "CANCELLED" ? [prisma.serviceAssignment.updateMany({ where: { serviceId: id, status: { in: ["OFFERED", "ACCEPTED"] } }, data: { status: "REJECTED", respondedAt: new Date() } })] : []),
    ]);
    await audit(me, "booking." + to.toLowerCase(), "Service", id, { from: s.status, reason });
    return "Booking updated.";
  });
}
export async function assignProvider(f: FormData) {
  await run("/admin/bookings", async (me) => {
    const sid = need(t(f, "id", 40), "Missing booking."), pid = need(t(f, "providerId", 40), "Choose a provider.");
    const [s, p] = await Promise.all([prisma.service.findUnique({ where: { id: sid } }), prisma.provider.findUnique({ where: { id: pid } })]);
    if (!s || !p) throw new UserError("Booking or provider not found.");
    if (!canMove(s.status, "ASSIGNED")) throw new UserError("Confirm the booking before assigning a provider.");
    if (p.status !== "VERIFIED" || !p.available) throw new UserError("Only verified, available providers can be assigned.");
    if (KIND[s.type] !== p.kind) throw new UserError("This provider's category does not match the service type.");
    const cfg = await prisma.pricingConfiguration.findFirst({ orderBy: { effectiveFrom: "desc" } });
    const u = (cfg?.unitCosts ?? {}) as Record<string, number>;
    const pay = s.type === "CLEANING" ? u.clean : s.type === "DOCTOR_VISIT" ? u.doc : s.type === "CHEF" ? u.chef : 0;
    await prisma.$transaction([
      prisma.serviceAssignment.updateMany({ where: { serviceId: sid, status: { in: ["OFFERED", "ACCEPTED"] } }, data: { status: "REJECTED", respondedAt: new Date() } }),
      prisma.serviceAssignment.upsert({ where: { serviceId_providerId: { serviceId: sid, providerId: pid } }, create: { serviceId: sid, providerId: pid, payoutAmount: pay ?? 0 }, update: { status: "OFFERED", respondedAt: null } }),
      prisma.service.update({ where: { id: sid }, data: { status: "ASSIGNED" } }),
    ]);
    await notify(p.userId, "New assignment offered", "A new service was assigned to you. Open your jobs to accept or decline.");
    await audit(me, "booking.assigned", "Service", sid, { providerId: pid, previous: s.status });
    return "Provider assigned. They must accept the job.";
  });
}
export async function rescheduleBooking(f: FormData) {
  await run("/admin/bookings", async (me) => {
    const id = need(t(f, "id", 40), "Missing booking."), when = new Date(t(f, "when", 40));
    if (isNaN(+when) || when < new Date()) throw new UserError("Choose a date and time in the future.");
    const s = await prisma.service.findUnique({ where: { id } });
    if (!s || !["PENDING", "CONFIRMED", "ASSIGNED", "ISSUE_REPORTED"].includes(s.status)) throw new UserError("This booking can no longer be rescheduled.");
    await prisma.service.update({ where: { id }, data: { scheduledAt: when } });
    await audit(me, "booking.rescheduled", "Service", id, { from: s.scheduledAt, to: when });
    return "Booking rescheduled.";
  });
}

// ---- Payments (bank transfers only; card/PayPal states must come from verified provider webhooks)
export async function reviewPayment(f: FormData) {
  await run("/admin/payments", async (me) => {
    const id = need(t(f, "id", 40), "Missing payment."), to = oneOf(t(f, "to"), ["VERIFIED", "FAILED", "REFUNDED"] as const);
    const p = await prisma.payment.findUnique({ where: { id } });
    if (!p || !to) throw new UserError("Payment not found.");
    if (to === "REFUNDED") {
      if (p.status !== "VERIFIED") throw new UserError("Only verified payments can be marked refunded.");
      await prisma.$transaction([prisma.payment.update({ where: { id }, data: { status: "REFUNDED" } }), prisma.subscription.update({ where: { id: p.subscriptionId }, data: { status: "CANCELLED", cancelledAt: new Date() } })]);
    } else {
      if (p.status !== "PENDING" || p.provider !== "BANK_TRANSFER") throw new UserError("Only pending bank transfers can be reviewed manually.");
      if (to === "FAILED") await prisma.payment.update({ where: { id }, data: { status: "FAILED" } });
      else {
        const now = new Date(), end = new Date(now); end.setMonth(end.getMonth() + 1);
        await prisma.$transaction([
          prisma.payment.update({ where: { id }, data: { status: "VERIFIED", verifiedById: me, verifiedAt: now } }),
          prisma.subscription.updateMany({ where: { id: p.subscriptionId, status: "PENDING_PAYMENT" }, data: { status: "ACTIVE", startsAt: now } }),
          prisma.invoice.create({ data: { number: `AHLI-${now.getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`, subscriptionId: p.subscriptionId, paymentId: id, amount: p.amount, periodStart: now, periodEnd: end } }),
        ]);
      }
    }
    await audit(me, "payment." + to.toLowerCase(), "Payment", id, { reference: p.reference });
    return to === "REFUNDED" ? "Marked refunded. Send the money back manually." : "Payment updated.";
  });
}
export async function markPayoutPaid(f: FormData) {
  await run("/admin/payments", async (me) => {
    const id = need(t(f, "id", 40), "Missing payout.");
    await prisma.providerPayout.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
    await audit(me, "payout.paid", "ProviderPayout", id);
    return "Payout marked as paid.";
  });
}

// ---- Complaints
export async function updateTicket(f: FormData) {
  await run("/admin/complaints", async (me) => {
    const id = need(t(f, "id", 40), "Missing case."), status = oneOf(t(f, "status"), ["OPEN", "IN_REVIEW", "WAITING_INFO", "RESOLVED", "CLOSED"] as const), resolution = t(f, "resolution", 1000);
    if (!status) throw new UserError("Choose a status.");
    if ((status === "RESOLVED" || status === "CLOSED") && !resolution) throw new UserError("Record the resolution first.");
    const tk = await prisma.supportTicket.update({ where: { id }, data: { status: status as TicketStatus, resolution: resolution || undefined, assignedToId: t(f, "assign") === "me" ? me : undefined } });
    if (status === "RESOLVED") await notify(tk.userId, "Your AHLI case was resolved", resolution);
    await audit(me, "ticket." + status.toLowerCase(), "SupportTicket", id);
    return "Case updated.";
  });
}
export async function addTicketNote(f: FormData) {
  await run("/admin/complaints", async (me) => {
    const id = need(t(f, "id", 40), "Missing case."), body = need(t(f, "body", 1000), "Write a note first.");
    await prisma.ticketNote.create({ data: { ticketId: id, authorId: me, body } });
    await audit(me, "ticket.note", "SupportTicket", id);
    return "Internal note saved.";
  });
}

// ---- Notifications and settings
export async function sendNotification(f: FormData) {
  await run("/admin/notifications", async (me) => {
    const email = need(t(f, "email", 254).toLowerCase(), "Enter the recipient's email."), title = need(t(f, "title", 120), "Add a title."), body = need(t(f, "body", 1000), "Write the message.");
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) throw new UserError("No user has that email.");
    await notify(u.id, title, body);
    await audit(me, "notification.sent", "User", u.id, { title });
    return "Notification created. (Email/SMS delivery is not connected yet.)";
  });
}
export async function updatePricing(f: FormData) {
  await run("/admin/settings", async (me) => {
    const n = (k: string, max: number) => { const v = Number(t(f, k, 12)); if (!isFinite(v) || v < 0 || v > max) throw new UserError("Check the numbers: values are out of range."); return v; };
    const fee = n("fee", 30), cont = n("cont", 50), clean = n("clean", 10000), doc = n("doc", 10000), chef = n("chef", 10000);
    const c = await prisma.pricingConfiguration.create({ data: { platformFeeBps: Math.round(fee * 100), contingencyBps: Math.round(cont * 100), unitCosts: { clean, doc, chef }, createdById: me } });
    await audit(me, "pricing.updated", "PricingConfiguration", c.id, { fee, cont, clean, doc, chef });
    return "New pricing saved. Existing subscriptions keep the price they signed up with.";
  });
}
