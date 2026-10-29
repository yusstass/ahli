"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function AdminLogin() {
  const router = useRouter(), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email"), password: f.get("password") }) });
    const d = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return setErr(d.error ?? "Something went wrong."); router.push(d.redirect); router.refresh();
  }
  const i = "w-full min-h-[44px] rounded-lg border border-[#e6dfd0] bg-white px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8902F]";
  return (
    <main className="grid min-h-screen place-items-center bg-[#12263F] px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-[#FBF7EF] p-7 text-[#12263F]">
        <p className="font-serif text-2xl">AHLI</p><h1 className="font-serif text-3xl">Administration</h1>
        <label className="mt-5 block font-semibold" htmlFor="e">Email</label><input id="e" name="email" type="email" required autoComplete="username" className={i} />
        <label className="mt-4 block font-semibold" htmlFor="p">Password</label><input id="p" name="password" type="password" required autoComplete="current-password" className={i} />
        {err && <p role="alert" className="mt-4 text-[#b3261e]">{err}</p>}
        <button disabled={busy} className="mt-6 min-h-[44px] w-full rounded-full bg-[#0f7a79] font-semibold text-white disabled:opacity-60">{busy ? "Please wait…" : "Sign in"}</button>
        <p className="mt-4 text-xs text-[#55667a]">Authorized staff only. Activity is logged.</p>
      </form>
    </main>
  );
}
