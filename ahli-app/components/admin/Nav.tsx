"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export const LINKS: [string, string][] = [["/admin", "Overview"], ["/admin/customers", "Customers"], ["/admin/providers", "Care Providers"], ["/admin/bookings", "Bookings & Visits"], ["/admin/subscriptions", "Subscriptions"], ["/admin/payments", "Payments & Payouts"], ["/admin/complaints", "Complaints & Reports"], ["/admin/notifications", "Notifications"], ["/admin/admins", "Admin Accounts & Roles"], ["/admin/audit", "Audit Logs"], ["/admin/settings", "Settings"]];
export default function Nav() {
  const p = usePathname();
  return (
    <nav aria-label="Admin" className="mt-6 flex flex-col gap-1">
      {LINKS.map(([h, l]) => { const on = h === "/admin" ? p === h : p.startsWith(h); return (
        <Link key={h} href={h} aria-current={on ? "page" : undefined} className={`min-h-[40px] rounded-lg px-3 py-2 text-sm font-semibold ${on ? "bg-[#12263F] text-white" : "text-[#12263F] hover:bg-[#FBF7EF]"}`}>{l}</Link>); })}
    </nav>
  );
}
