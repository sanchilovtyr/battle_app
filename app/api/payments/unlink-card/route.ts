import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!sub) return NextResponse.json({ error: "Подписка не найдена" }, { status: 404 });

  // Отвязываем сохранённый способ оплаты — дальше списать деньги с этой карты
  // без нового явного действия клиента станет невозможно. Само автопродление
  // (если оно было включено) тоже перестанет работать, пока клиент не оплатит заново
  await prisma.subscription.update({
    where: { userId: user.id },
    data: { paymentMethodId: null },
  });

  return NextResponse.json({ ok: true });
}
