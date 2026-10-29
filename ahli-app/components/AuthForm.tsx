"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const input = "w-full min-h-[44px] rounded-lg border border-[#e6dfd0] bg-white px-3 text-[#12263F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8902F]";
export default function AuthForm({ mode, next, error }: { mode: "login" | "register"; next?: string; error?: string }) {
  const router = useRouter(), reg = mode === "register";
  const [err, setErr] = useState(error ?? ""), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setBusy(true);
    const f = new FormData(e.currentTarget);
    const body = reg
      ? { name: f.get("name"), email: f.get("email"), password: f.get("password"), role: f.get("role"), acceptTerms: f.get("terms") === "on" }
      : { email: f.get("email"), password: f.get("password"), next };
    const r = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error ?? "Something went wrong. Try again.");
    router.push(d.redirect); router.refresh();
  }
  return (
    <main className="min-h-screen bg-[#FBF7EF] px-5 py-12">
      <form onSubmit={submit} className="mx-auto max-w-md rounded-2xl border border-[#e6dfd0] bg-white p-7 shadow-sm">
        <h1 className="font-serif text-3xl text-[#12263F]">{reg ? "Create your AHLI account" : "Log in to AHLI"}</h1>
        <a href={`/api/auth/google${next ? "?next=" + encodeURIComponent(next) : ""}`} className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-3 rounded-full border border-[#12263F] font-semibold text-[#12263F]">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </a>
        <p className="mt-2 text-xs text-[#55667a]">Accounts created with Google are family accounts. By continuing you accept the Terms and Privacy Policy (drafts).</p>
        <div className="my-5 flex items-center gap-3 text-sm text-[#55667a]"><span className="h-px flex-1 bg-[#e6dfd0]" />or with email<span className="h-px flex-1 bg-[#e6dfd0]" /></div>
        {reg && (<><label className="mt-4 block font-semibold" htmlFor="name">Full name</label><input id="name" name="name" required autoComplete="name" className={input} />
          <label className="mt-4 block font-semibold" htmlFor="role">I am a</label>
          <select id="role" name="role" className={input}><option value="FAMILY">Family member</option><option value="PROVIDER">Service provider (needs AHLI approval)</option></select></>)}
        <label className="mt-4 block font-semibold" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className={input} />
        <label className="mt-4 block font-semibold" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={reg ? 10 : 1} autoComplete={reg ? "new-password" : "current-password"} className={input} />
        {reg && <p className="mt-1 text-sm text-[#55667a]">At least 10 characters.</p>}
        {reg && (<label className="mt-4 flex gap-2 text-sm"><input type="checkbox" name="terms" required className="mt-1" />I accept the Terms and Privacy Policy (drafts, pending legal review).</label>)}
        {err && <p role="alert" className="mt-4 text-[#b3261e]">{err}</p>}
        <button disabled={busy} className="mt-6 min-h-[44px] w-full rounded-full bg-[#0f7a79] font-semibold text-white disabled:opacity-60">{busy ? "Please wait…" : reg ? "Create account" : "Log in"}</button>
        <p className="mt-4 text-sm"><a className="text-[#0f7a79] underline" href={reg ? "/login" : "/register"}>{reg ? "I already have an account" : "Create an account"}</a></p>
      </form>
    </main>
  );
}
