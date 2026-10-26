// Серверная проверка доступа к «Управлению рисками» (только «Премиум») для API мониторинга.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { computeEffectivePlanId } from "@/lib/subscriptionUtils";
import { getPlan } from "@/lib/plans";

export async function requireRisksUser(): Promise<{ user: { id: string; email?: string | null } } | { error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user?.id) return { error: NextResponse.json({ error: "Не авторизован" }, { status: 401 }) };
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  const plan = getPlan(computeEffectivePlanId(sub ? { planId: sub.planId, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null));
  if (!plan.risksAccess) return { error: NextResponse.json({ error: "Управление рисками доступно на тарифе «Премиум»" }, { status: 403 }) };
  return { user: { id: user.id, email: user.email } };
}

/** Простой ограничитель частоты изменений на пользователя (в памяти процесса). */
const hits = new Map<string, number[]>();
export function tooManyActions(userId: string, max = 12, windowMs = 60_000): boolean {
  const now = Date.now();
  const list = (hits.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) {
    hits.set(userId, list);
    return true;
  }
  list.push(now);
  hits.set(userId, list);
  return false;
}
