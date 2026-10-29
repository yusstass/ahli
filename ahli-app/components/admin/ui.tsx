import Link from "next/link";
import { PAGE } from "@/lib/admin";
export const inp = "min-h-[40px] rounded-lg border border-[#e6dfd0] bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8902F]";
export const btn = "min-h-[40px] rounded-full bg-[#0f7a79] px-4 text-sm font-semibold text-white";
export const card = "rounded-2xl border border-[#e6dfd0] bg-white p-5";
export const H = ({ children }: { children: React.ReactNode }) => <h1 className="mb-4 font-serif text-3xl">{children}</h1>;
export const Empty = ({ text }: { text: string }) => <p className="rounded-xl border border-dashed border-[#e6dfd0] p-6 text-center text-[#55667a]">{text}</p>;
const tones: Record<string, string> = { ok: "bg-[#0f7a7922] text-[#0f7a79]", warn: "bg-[#B8902F22] text-[#8a6a1c]", bad: "bg-[#b3261e1a] text-[#b3261e]", n: "bg-[#12263F12] text-[#12263F]" };
const tone = (s: string) => (/VERIFIED|ACTIVE|COMPLETED|RESOLVED|APPROVED|CLOSED/.test(s) ? "ok" : /REJECT|CANCEL|SUSPEND|FAIL|ISSUE|HIGH|REFUND/.test(s) ? "bad" : /PENDING|REVIEW|WAIT|OPEN|MEDIUM|ASSIGNED/.test(s) ? "warn" : "n");
export const Badge = ({ s, disabled }: { s: string; disabled?: boolean }) => <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[disabled ? "bad" : tone(s)]}`}>{disabled ? "SUSPENDED" : s.replace(/_/g, " ")}</span>;
export const Stat = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) => <div className={card}><p className="text-sm text-[#55667a]">{label}</p><p className="font-serif text-3xl">{value}</p>{hint && <p className="text-xs text-[#55667a]">{hint}</p>}</div>;
export const Flash = ({ sp }: { sp: { msg?: string; err?: string } }) => sp.err ? <p role="alert" className="mb-4 rounded-xl bg-[#b3261e1a] p-3 text-[#b3261e]">{sp.err}</p> : sp.msg ? <p role="status" className="mb-4 rounded-xl bg-[#0f7a7922] p-3 text-[#0f7a79]">{sp.msg}</p> : null;
export function Pager({ page, total, sp, base }: { page: number; total: number; sp: Record<string, string | undefined>; base: string }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number) => { const q = new URLSearchParams(); for (const [k, v] of Object.entries(sp)) if (v && !["page", "msg", "err"].includes(k)) q.set(k, v); q.set("page", String(p)); return `${base}?${q}`; };
  return <nav aria-label="Pagination" className="mt-4 flex items-center gap-4 text-sm"><span>{total} result{total === 1 ? "" : "s"} · page {page} of {pages}</span>{page > 1 && <Link className="font-semibold text-[#0f7a79] underline" href={href(page - 1)}>Previous</Link>}{page < pages && <Link className="font-semibold text-[#0f7a79] underline" href={href(page + 1)}>Next</Link>}</nav>;
}
export function Bars({ data, label, unit = "" }: { data: { k: string; v: number }[]; label: string; unit?: string }) {
  if (data.length < 2 || data.every((d) => d.v === 0)) return <Empty text="Not enough data yet to draw this chart." />;
  const max = Math.max(...data.map((d) => d.v), 1);
  return <div role="img" aria-label={label} className="flex h-44 items-end gap-3">{data.map((d) => <div key={d.k} className="flex flex-1 flex-col items-center justify-end gap-1"><span className="text-xs">{d.v}{unit}</span><div className="w-full rounded-t bg-[#0f7a79]" style={{ height: Math.max(4, Math.round((d.v / max) * 120)) }} /><span className="text-xs text-[#55667a]">{d.k}</span></div>)}</div>;
}
