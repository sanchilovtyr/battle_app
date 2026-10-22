// Промокоды: работа с базой (только сервер). Правила — в lib/promoCore.ts.

import { prisma } from "@/lib/db";
import { computeEffectivePlanId } from "@/lib/subscriptionUtils";
import { getPlan, PlanId } from "@/lib/plans";
import { PROMO_PERIOD_DAYS, PROMO_PLAN_IDS, evaluatePromo, normalizeCode, priceWithPromo, promoSummary, type PromoPrice } from "@/lib/promoCore";

const db = prisma as any;

export const rubFromPriceLabel = (price: string): number => Number(price.replace(/[^\d]/g, "")) || 0;

export interface PromoRow {
  id: string;
  code: string;
  percent: number;
  planId: string;
  active: boolean;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
}

export async function effectivePlanIdOf(userId: string): Promise<PlanId> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return computeEffectivePlanId(sub ? { planId: sub.planId, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null);
}

export type PromoCheck =
  | { ok: true; promo: PromoRow; price: PromoPrice }
  | { ok: false; error: string; status: number };

/** Полная проверка: код существует и действует, пользователь на бесплатном тарифе и ещё не использовал код. */
export async function checkPromoForUser(userId: string, rawCode: unknown, planId: PlanId): Promise<PromoCheck> {
  const code = normalizeCode(rawCode);
  const promo = code ? ((await db.promoCode.findUnique({ where: { code } })) as PromoRow | null) : null;
  const used = promo ? !!(await db.promoRedemption.findUnique({ where: { promoId_userId: { promoId: promo.id, userId } }, select: { id: true } })) : false;
  const verdict = evaluatePromo(promo, { now: new Date(), planId, effectivePlanId: await effectivePlanIdOf(userId), alreadyUsedByUser: used });
  if (!verdict.ok || !promo) return { ok: false, error: verdict.ok ? "Промокод не найден или больше не действует" : verdict.message, status: 400 };
  const plan = getPlan(planId);
  return { ok: true, promo, price: priceWithPromo(rubFromPriceLabel(plan.price), promo.percent) };
}

/** Фиксирует использование после успешной оплаты (или выдачи бесплатного месяца). Повторный вызов безопасен. */
export async function recordRedemption(promoId: string, userId: string, paymentId: string | null): Promise<boolean> {
  try {
    await db.$transaction([
      db.promoRedemption.create({ data: { promoId, userId, paymentId } }),
      db.promoCode.update({ where: { id: promoId }, data: { usedCount: { increment: 1 } } }),
    ]);
    return true;
  } catch {
    return false; // пара уже записана
  }
}

/** Бесплатный месяц по промокоду на 100%: без платежа и без автопродления (подписка сразу «отменена», доступ до конца периода). */
export async function grantFreeMonth(userId: string, promo: PromoRow, planId: PlanId): Promise<boolean> {
  // Занимаем место под лимит использований одним условным обновлением — два одновременных запроса не превысят лимит
  const claimed = await db.promoCode.updateMany({
    where: { id: promo.id, active: true, ...(promo.maxUses !== null ? { usedCount: { lt: promo.maxUses } } : {}) },
    data: { usedCount: { increment: 1 } },
  });
  if (!claimed.count) return false;
  const end = new Date(Date.now() + PROMO_PERIOD_DAYS * 86400000);
  try {
    await db.$transaction([
      db.promoRedemption.create({ data: { promoId: promo.id, userId, paymentId: null } }),
      db.payment.create({
        data: { userId, yookassaId: `promo-${promo.id}-${userId}`, planId, amountKopecks: 0, status: "succeeded", promoCodeId: promo.id, discountKopecks: 0 },
      }),
      db.subscription.upsert({
        where: { userId },
        create: { userId, planId, status: "cancelled", currentPeriodEnd: end },
        update: { planId, status: "cancelled", currentPeriodEnd: end, paymentMethodId: null },
      }),
    ]);
    return true;
  } catch {
    await db.promoCode.update({ where: { id: promo.id }, data: { usedCount: { decrement: 1 } } }).catch(() => undefined);
    return false;
  }
}

export interface PromoPlanOffer {
  planId: PlanId;
  originalRub: number;
  finalRub: number;
  free: boolean;
  text: string;
}

export type PromoOffers =
  | { ok: true; code: string; percent: number; offers: PromoPlanOffer[] }
  | { ok: false; error: string; status: number };

/** Проверка кода для экрана тарифов: возвращает цену со скидкой для каждого платного тарифа, на который код действует. */
export async function offersForCode(userId: string, rawCode: unknown): Promise<PromoOffers> {
  const code = normalizeCode(rawCode);
  const promo = code ? ((await db.promoCode.findUnique({ where: { code } })) as PromoRow | null) : null;
  const used = promo ? !!(await db.promoRedemption.findUnique({ where: { promoId_userId: { promoId: promo.id, userId } }, select: { id: true } })) : false;
  const effective = await effectivePlanIdOf(userId);
  const offers: PromoPlanOffer[] = [];
  let firstError = "Промокод не найден или больше не действует";
  for (const pid of PROMO_PLAN_IDS) {
    const verdict = evaluatePromo(promo, { now: new Date(), planId: pid, effectivePlanId: effective, alreadyUsedByUser: used });
    if (!verdict.ok) {
      // Сообщение «действует только на тариф…» важнее, чем «не найден»: оно подсказывает, куда применить код
      if (verdict.code !== "wrong_plan" || firstError.startsWith("Промокод не найден")) firstError = verdict.message;
      if (verdict.code === "wrong_plan") continue;
      return { ok: false, error: verdict.message, status: 400 };
    }
    const plan = getPlan(pid);
    const price = priceWithPromo(rubFromPriceLabel(plan.price), promo!.percent);
    offers.push({ planId: pid, originalRub: price.originalRub, finalRub: price.finalRub, free: price.free, text: promoSummary(price, promo!.percent, plan.price) });
  }
  if (!offers.length || !promo) return { ok: false, error: firstError, status: 400 };
  return { ok: true, code: promo.code, percent: promo.percent, offers };
}
