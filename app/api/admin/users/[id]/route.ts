import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { PLANS } from "@/lib/plans";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  try {
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Не удалось удалить пользователя", e);
    return NextResponse.json({ error: "Пользователь не найден или уже удалён" }, { status: 404 });
  }
}

/** Ручная установка тарифа пользователю в обход оплаты — чтобы владелец
 *  сервиса мог зайти под своим аккаунтом и проверить, как выглядит и
 *  работает каждый тариф. Реальные платежи (Payment) это не трогает. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const planId = String(body?.planId ?? "");
  if (!PLANS.some((p) => p.id === planId)) {
    return NextResponse.json({ error: "Некорректный тариф" }, { status: 400 });
  }

  // На пробном тарифе период не нужен; на платных ставим условный месяц
  // вперёд, чтобы личный кабинет отображал состояние как у настоящей подписки
  const currentPeriodEnd = planId === "trial" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  try {
    await prisma.subscription.upsert({
      where: { userId: params.id },
      update: { planId, status: "active", currentPeriodEnd },
      create: { userId: params.id, planId, status: "active", currentPeriodEnd },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Не удалось выставить тестовый тариф", e);
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
}
