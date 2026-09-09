import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createYookassaPayment } from "@/lib/yookassa";
import { getPlan, PlanId } from "@/lib/plans";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

function rubFromPriceLabel(price: string): number {
  return Number(price.replace(/[^\d]/g, "")) || 0;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Сначала зарегистрируйтесь или войдите" }, { status: 401 });
  }

  if (!checkRateLimit(`create-payment:${user.id}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Слишком много попыток оплаты подряд. Попробуйте через несколько минут." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const planId = body.planId as PlanId;
  const plan = getPlan(planId);

  if (!plan || plan.free) {
    return NextResponse.json({ error: "Этот тариф нельзя оплатить" }, { status: 400 });
  }

  const amountRub = rubFromPriceLabel(plan.price);
  // Не берём адрес возврата из заголовка Origin — его может прислать любой,
  // а не только настоящий браузер пользователя. Используем свой настроенный адрес
  const siteUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  let payment;
  try {
    payment = await createYookassaPayment({
      amountRub,
      description: `Подписка «${plan.name}» — сервис «Ключевое слово»`,
      returnUrl: `${siteUrl}/account?payment=done`,
      metadata: { userId: user.id, planId },
      savePaymentMethod: true,
    });
  } catch (e) {
    console.error("YooKassa createPayment failed", e);
    return NextResponse.json({ error: "Не удалось создать платёж" }, { status: 502 });
  }

  await prisma.payment.create({
    data: {
      userId: user.id,
      yookassaId: payment.id,
      planId,
      amountKopecks: Math.round(amountRub * 100),
      status: payment.status,
    },
  });

  return NextResponse.json({ confirmationUrl: payment.confirmation?.confirmation_url });
}
