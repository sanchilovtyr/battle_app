import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getDecryptedConnection, fetchStats, currentMonthRange } from "@/lib/yandexMetrika";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!checkRateLimit(`metrika-data:${user.id}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Слишком много запросов подряд" }, { status: 429 });
  }

  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "Не указан businessId" }, { status: 400 });
  }

  const connection = await getDecryptedConnection(user.id, businessId);
  if (!connection || !connection.counterId) {
    return NextResponse.json({ error: "Сначала выберите счётчик Метрики" }, { status: 404 });
  }

  const date1 = url.searchParams.get("date1");
  const date2 = url.searchParams.get("date2");
  const range = date1 && date2 ? { date1, date2 } : currentMonthRange();

  try {
    const stats = await fetchStats(connection.accessToken, connection.counterId, {
      ...range,
      leadsGoalId: connection.leadsGoalId,
      salesGoalId: connection.salesGoalId,
    });
    return NextResponse.json({ ...stats, ...range });
  } catch (e) {
    console.error("Не удалось получить статистику из Метрики", e);
    return NextResponse.json(
      { error: "Не удалось получить данные из Метрики. Попробуйте переподключить счётчик." },
      { status: 502 }
    );
  }
}
