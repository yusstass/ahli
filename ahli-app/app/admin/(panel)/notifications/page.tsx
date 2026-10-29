import { prisma } from "@/lib/db";
import { fmt, requireAdmin } from "@/lib/admin";
import { sendNotification } from "@/app/admin/actions";
import { btn, card, Empty, Flash, H, inp } from "@/components/admin/ui";
export default async function Page({ searchParams: sp }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin();
  const rows = await prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { email: true } } } });
  return (<>
    <H>Notifications</H><Flash sp={sp} />
    <form action={sendNotification} className={`${card} mb-6 grid gap-2`}><label htmlFor="em" className="font-semibold">Send to (user email)</label><input id="em" name="email" type="email" required className={inp} />
      <label htmlFor="ti" className="font-semibold">Title</label><input id="ti" name="title" required maxLength={120} className={inp} /><label htmlFor="bo" className="font-semibold">Message</label><textarea id="bo" name="body" required maxLength={1000} rows={3} className={`${inp} py-2`} />
      <p className="text-xs text-[#55667a]">This creates an in-app notification. Email, SMS or WhatsApp delivery is not connected yet.</p><button className={`${btn} w-fit`}>Send notification</button></form>
    <h2 className="mb-3 font-serif text-xl">Latest notifications</h2>
    {!rows.length ? <Empty text="Nothing sent yet." /> : rows.map((n) => <div key={n.id} className={`${card} mb-2 text-sm`}><b>{n.title}</b> · {n.user.email} · {fmt(n.createdAt)} · {n.readAt ? "read" : "unread"}</div>)}</>);
}
