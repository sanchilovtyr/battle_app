import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getDecryptedConnection, fetchCounters } from "@/lib/yandexMetrika";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!checkRateLimit(`metrika-counters:${user.id}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Слишком много запросов подряд" }, { status: 429 });
  }

  const businessId = new URL(req.url).searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "Не указан businessId" }, { status: 400 });
  }

  const connection = await getDecryptedConnection(user.id, businessId);
  if (!connection) {
    return NextResponse.json({ error: "Метрика не подключена для этого бизнеса" }, { status: 404 });
  }

  try {
    const counters = await fetchCounters(connection.accessToken);
    return NextResponse.json({ counters });
  } catch (e) {
    console.error("Не удалось получить список счётчиков Метрики", e);
    return NextResponse.json(
      { error: "Не удалось получить список счётчиков. Попробуйте переподключить Метрику." },
      { status: 502 }
    );
  }
}
