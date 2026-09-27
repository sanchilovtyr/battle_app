import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getDecryptedConnection, fetchGoals } from "@/lib/yandexMetrika";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!checkRateLimit(`metrika-goals:${user.id}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Слишком много запросов подряд" }, { status: 429 });
  }

  const businessId = new URL(req.url).searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "Не указан businessId" }, { status: 400 });
  }

  const connection = await getDecryptedConnection(user.id, businessId);
  if (!connection || !connection.counterId) {
    return NextResponse.json({ error: "Сначала выберите счётчик Метрики" }, { status: 404 });
  }

  try {
    const goals = await fetchGoals(connection.accessToken, connection.counterId);
    return NextResponse.json({ goals });
  } catch (e) {
    console.error("Не удалось получить список целей Метрики", e);
    return NextResponse.json({ error: "Не удалось получить список целей счётчика" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const businessId = String(body?.businessId ?? "");
  if (!businessId) {
    return NextResponse.json({ error: "Не указан businessId" }, { status: 400 });
  }

  const leadsGoalId = body?.leadsGoalId ? String(body.leadsGoalId) : null;
  const salesGoalId = body?.salesGoalId ? String(body.salesGoalId) : null;

  try {
    await prisma.metrikaConnection.update({
      where: { userId_businessId: { userId: user.id, businessId } },
      data: { leadsGoalId, salesGoalId },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Не удалось сохранить сопоставление целей Метрики", e);
    return NextResponse.json({ error: "Метрика не подключена для этого бизнеса" }, { status: 404 });
  }
}
