import Shell from "@/components/admin/Shell";
import { requireAdmin } from "@/lib/admin";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const s = await requireAdmin(); // pages and actions check again: layouts do not re-run on every navigation
  return <Shell email={s.user.email}>{children}</Shell>;
}
