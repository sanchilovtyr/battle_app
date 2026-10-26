import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { createYookassaPayment } from "@/lib/yookassa";
import { getPlan, PlanId } from "@/lib/plans";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkPromoForUser, grantFreeMonth } from "@/lib/promo";
import { linkVisitorToUser, vidFromCookieHeader } from "@/lib/analyticsStore";

function rubFromPriceLabel(price: string): number {
  return Number(price.replace(/[^\d]/g, "")) || 0;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Сначала зарегистрируйтесь или войдите" }, { status: 401 });
  }

  if (!checkRateLimit(`create-payment:${user.id}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Слишком много попыток оплаты подряд. Попробуйте через несколько минут." },
      { status: 429 }
    );
  }

  // Страховка для аналитики: если вход был с другого устройства, источник всё равно привяжется
  await linkVisitorToUser(vidFromCookieHeader(req.headers.get("cookie")), user.id);

  const body = await req.json().catch(() => ({}));
  const planId = body.planId as PlanId;
  const plan = getPlan(planId);

  if (!plan || plan.free) {
    return NextResponse.json({ error: "Этот тариф нельзя оплатить" }, { status: 400 });
  }

  let amountRub = rubFromPriceLabel(plan.price);
  const fullRub = amountRub;
  let promoId: string | undefined;
  let promoCodeText = "";
  if (typeof body.promoCode === "string" && body.promoCode.trim()) {
    // Цену со скидкой считает только сервер: сумма из запроса не принимается
    const check = await checkPromoForUser(user.id, body.promoCode, planId);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
    if (check.price.free) {
      const granted = await grantFreeMonth(user.id, check.promo, planId);
      if (!granted) return NextResponse.json({ error: "Промокод больше не действует" }, { status: 400 });
      return NextResponse.json({ activated: true });
    }
    amountRub = check.price.finalRub;
    promoId = check.promo.id;
    promoCodeText = check.promo.code;
  }
  // Не берём адрес возврата из заголовка Origin — его может прислать любой,
  // а не только настоящий браузер пользователя. Используем свой настроенный адрес
  const siteUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  let payment;
  try {
    payment = await createYookassaPayment({
      amountRub,
      description: `Подписка «${plan.name}»${promoCodeText ? ` (первый месяц по промокоду)` : ""} — сервис «Ключевое слово»`,
      returnUrl: `${siteUrl}/account?payment=done`,
      metadata: { userId: user.id, planId, ...(promoId ? { promoId } : {}) },
      savePaymentMethod: true,
      customerEmail: user.email,
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
      ...(promoId ? { promoCodeId: promoId, discountKopecks: Math.round((fullRub - amountRub) * 100) } : {}),
    },
  });

  return NextResponse.json({ confirmationUrl: payment.confirmation?.confirmation_url });
}
