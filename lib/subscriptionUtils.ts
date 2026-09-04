import { PlanId } from "./plans";

export interface SubscriptionLike {
  planId: string;
  status: string;
  currentPeriodEnd: string | Date | null;
}

/** Тариф, который реально действует: отменённая и уже истёкшая подписка
 *  откатывает к пробному, но пока не истёк оплаченный период — доступ сохраняется */
export function computeEffectivePlanId(sub: SubscriptionLike | null | undefined): PlanId {
  if (!sub || sub.planId === "trial") return "trial";
  if (sub.status === "active") return sub.planId as PlanId;

  const end = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getTime() : 0;
  const stillWithinPeriod = end > Date.now();
  return stillWithinPeriod ? (sub.planId as PlanId) : "trial";
}
