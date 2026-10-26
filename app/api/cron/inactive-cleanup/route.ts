import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runInactivityCleanup } from "@/lib/inactivity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Предупреждение и удаление неактивных аккаунтов (30 дней). Вызывается по расписанию: POST с x-cron-secret.
 *  Если уже настроен ежедневный /api/cron/seo-audit, отдельный запуск не нужен — он делает то же самое. */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret") || "";
  const expected = process.env.CRON_SECRET || "";
  if (!expected || !safeCompare(secret, expected)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, result: await runInactivityCleanup() });
  } catch (e) {
    console.error("Неактивные аккаунты: ошибка очистки", e);
    return NextResponse.json({ error: "Ошибка очистки" }, { status: 500 });
  }
}
