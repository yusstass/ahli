import { requireRole } from "@/lib/session";
export default async function Page() {
  const s = await requireRole("FAMILY");
  return (
    <main className="min-h-screen bg-[#FBF7EF] p-8 text-[#12263F]">
      <h1 className="font-serif text-3xl">Welcome, {s.user.name}</h1>
      <p className="mt-2">Signed in as FAMILY. Dashboard screens from the prototype are wired here next.</p>
      <form action="/api/auth/logout" method="post"><button className="mt-6 min-h-[44px] rounded-full border border-[#12263F] px-5 font-semibold">Log out</button></form>
    </main>
  );
}
