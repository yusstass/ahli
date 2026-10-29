import { redirect } from "next/navigation";
import AdminLogin from "@/components/admin/AdminLogin";
import { getSession } from "@/lib/session";
export default async function Page() {
  const s = await getSession();
  if (s?.user.role === "ADMIN") redirect("/admin");
  return <AdminLogin />;
}
