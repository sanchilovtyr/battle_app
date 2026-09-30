import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getYookassaPayment } from "@/lib/yookassa";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const PERIOD_DAYS = 30;

export async function POST(req: Request) {
  // Мягкий лимит на весь адрес — легитимные уведомления от ЮKassa сюда
  // не упрутся, а вот направленный поток поддельных запросов притормозится
  if (!checkRateLimit(`webhook:${getClientIp(req)}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: "Слишком много запросов" }, { status: 429 });
  }

  let event: { object?: { id?: string } };
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
  }

  const paymentId = event.object?.id;
  if (!paymentId) {
    return NextResponse.json({ error: "Нет id платежа" }, { status: 400 });
  }

  // Не доверяем статусу из тела вебхука — запрашиваем актуальный статус напрямую у ЮKassa.
  // Так вебхук нельзя подделать сторонним POST-запросом на этот адрес.
  let payment;
  try {
    payment = await getYookassaPayment(paymentId);
  } catch (e) {
    console.error("YooKassa getPayment failed in webhook", e);
    return NextResponse.json({ error: "Не удалось проверить платёж" }, { status: 502 });
  }

  const record = await prisma.payment.findUnique({ where: { yookassaId: paymentId } });
  if (!record) {
    // платёж создан не через наш /api/payments/create — игнорируем
    return NextResponse.json({ ok: true });
  }

  if (payment.status === "succeeded" && record.status !== "succeeded") {
    const periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + PERIOD_DAYS);
    const savedMethodId: string | undefined = payment.payment_method?.saved
      ? payment.payment_method.id
      : undefined;

    await prisma.$transaction([
      prisma.payment.update({
        where: { yookassaId: paymentId },
        data: { status: "succeeded" },
      }),
      prisma.subscription.upsert({
        where: { userId: record.userId },
        create: {
          userId: record.userId,
          planId: record.planId,
          status: "active",
          currentPeriodEnd: periodEnd,
          paymentMethodId: savedMethodId,
        },
        update: {
          planId: record.planId,
          status: "active",
          currentPeriodEnd: periodEnd,
          ...(savedMethodId ? { paymentMethodId: savedMethodId } : {}),
        },
      }),
    ]);
  } else if (payment.status === "canceled" && record.status !== "canceled") {
    await prisma.payment.update({
      where: { yookassaId: paymentId },
      data: { status: "canceled" },
    });
  }

  return NextResponse.json({ ok: true });
}
