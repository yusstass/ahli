import { prisma } from "@/lib/db";
import { fmt, requireAdmin } from "@/lib/admin";
import { updatePricing } from "@/app/admin/actions";
import ConfirmButton from "@/components/admin/ConfirmButton";
import { card, Flash, H, inp } from "@/components/admin/ui";
export default async function Page({ searchParams: sp }: { searchParams: Record<string, string | undefined> }) {
  await requireAdmin();
  const c = await prisma.pricingConfiguration.findFirst({ orderBy: { effectiveFrom: "desc" } });
  const u = (c?.unitCosts ?? { clean: 0, doc: 0, chef: 0 }) as { clean: number; doc: number; chef: number };
  const F = ({ n, l, v }: { n: string; l: string; v: number }) => <div><label htmlFor={n} className="font-semibold">{l}</label><input id={n} name={n} type="number" step="0.01" min="0" required defaultValue={v} className={`${inp} w-full`} /></div>;
  return (<>
    <H>Settings</H><Flash sp={sp} />
    <form action={updatePricing} className={`${card} max-w-xl space-y-3`}>
      <h2 className="font-serif text-xl">Pricing model</h2><p className="text-sm text-[#55667a]">Plan prices are calculated from these numbers. A change applies to new subscriptions only. Last saved {fmt(c?.effectiveFrom)}.</p>
      <F n="fee" l="AHLI platform fee (%)" v={(c?.platformFeeBps ?? 700) / 100} /><F n="cont" l="Operational reserve (%)" v={(c?.contingencyBps ?? 800) / 100} />
      <F n="clean" l="Cleaning visit cost (TND)" v={u.clean} /><F n="doc" l="Doctor visit cost (TND)" v={u.doc} /><F n="chef" l="Chef visit cost (TND)" v={u.chef} />
      <ConfirmButton label="Save new pricing" message="Save new pricing? This is recorded in the audit log." /></form></>);
}
