// Price = (service cost + reserve) / (1 - AHLI fee), rounded up to 5 TND. All inputs are database rows.
export type Cfg = { platformFeeBps: number; contingencyBps: number; unitCosts: { clean: number; doc: number; chef: number } };
export type PlanLike = { doctorVisits: number; cleaningVisits: number; chefVisits: number; medAllowance: unknown; priorityReserve: unknown; coordinationCost: unknown };
export const serviceCost = (p: PlanLike, c: Cfg) =>
  p.doctorVisits * c.unitCosts.doc + p.cleaningVisits * c.unitCosts.clean + p.chefVisits * c.unitCosts.chef +
  Number(p.medAllowance) + Number(p.priorityReserve) + Number(p.coordinationCost);
export function price(p: PlanLike, c: Cfg) {
  const cost = serviceCost(p, c);
  const total = Math.ceil((cost * (1 + c.contingencyBps / 1e4)) / (1 - c.platformFeeBps / 1e4) / 5) * 5;
  return { total, cost, fee: total * c.platformFeeBps / 1e4, reserve: cost * c.contingencyBps / 1e4 };
}
