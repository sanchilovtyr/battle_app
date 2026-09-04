import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createYookassaPayment } from "@/lib/yookassa";
import { getPlan, PlanId } from "@/lib/plans";

function rubFromPriceLabel(price: string): number {
  return Number(price.replace(/[^\d]/g, "")) || 0;
}

/**
 * Дёргается по расписанию (Timeweb «Планировщик задач» / внешний cron-пинг).
 * Находит подписки, у которых заканчивается оплаченный период, автопродление
 * не отменено и есть сохранённый способ оплаты — и списывает следующий период.
 * Само продление даты и статуса делает не этот роут, а /api/payments/webhook,
 * когда ЮKassa пришлёт результат списания — так логика продления остаётся в одном месте.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const dueBefore = new Date();
  dueBefore.setHours(dueBefore.getHours() + 24); // продлеваем за сутки до конца периода

  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      status: "active",
      paymentMethodId: { not: null },
      currentPeriodEnd: { lte: dueBefore },
    },
  });

  const results: { userId: string; ok: boolean; error?: string }[] = [];

  for (const sub of dueSubscriptions) {
    const plan = getPlan(sub.planId as PlanId);
    if (plan.free || !sub.paymentMethodId) continue;

    try {
      const payment = await createYookassaPayment({
        amountRub: rubFromPriceLabel(plan.price),
        description: `Продление подписки «${plan.name}» — сервис «Ключевое слово»`,
        returnUrl: process.env.NEXTAUTH_URL || "http://localhost:3000",
        metadata: { userId: sub.userId, planId: sub.planId, renewal: "true" },
        paymentMethodId: sub.paymentMethodId,
      });

      await prisma.payment.create({
        data: {
          userId: sub.userId,
          yookassaId: payment.id,
          planId: sub.planId,
          amountKopecks: Math.round(rubFromPriceLabel(plan.price) * 100),
          status: payment.status,
        },
      });

      results.push({ userId: sub.userId, ok: true });
    } catch (e) {
      console.error("Renewal charge failed for", sub.userId, e);
      results.push({ userId: sub.userId, ok: false, error: String(e) });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
