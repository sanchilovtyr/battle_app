import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (!sub) return NextResponse.json({ error: "Подписка не найдена" }, { status: 404 });

  await prisma.subscription.update({
    where: { userId: user.id },
    data: { status: "cancelled" },
  });

  return NextResponse.json({ ok: true });
}
