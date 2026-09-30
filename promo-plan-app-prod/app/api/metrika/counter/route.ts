import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const businessId = String(body?.businessId ?? "");
  const counterId = String(body?.counterId ?? "");
  const counterName = body?.counterName ? String(body.counterName).slice(0, 200) : null;

  if (!businessId || !counterId) {
    return NextResponse.json({ error: "Не указан businessId или counterId" }, { status: 400 });
  }

  try {
    await prisma.metrikaConnection.update({
      where: { userId_businessId: { userId: user.id, businessId } },
      // Смена счётчика сбрасывает ранее выбранные цели — они привязаны к конкретному счётчику
      data: { counterId, counterName, leadsGoalId: null, salesGoalId: null },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Не удалось сохранить выбранный счётчик Метрики", e);
    return NextResponse.json({ error: "Метрика не подключена для этого бизнеса" }, { status: 404 });
  }
}
