import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sendDailyReport } from "@/lib/dailyReport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeCompare(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Суточный отчёт в Telegram (посетители по каналам, выручка, новые пользователи).
 * POST с заголовком x-cron-secret, раз в сутки утром. Необязательно: ?date=YYYY-MM-DD — за другой день,
 * ?dry=1 — вернуть текст, ничего не отправляя.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret") || "";
  const expected = process.env.CRON_SECRET || "";
  if (!expected || !safeCompare(secret, expected)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const url = new URL(req.url);
  try {
    const r = await sendDailyReport(url.searchParams.get("date"), url.searchParams.get("dry") === "1");
    return NextResponse.json({ ok: true, sent: r.sent, text: r.text });
  } catch (e) {
    console.error("Суточный отчёт: не удалось отправить", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ошибка" }, { status: 500 });
  }
}
