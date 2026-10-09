import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runSeoAudit, sendSeoDigest } from "@/lib/seoRun";
import { pingPendingPosts } from "@/lib/indexnow";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Ежедневная SEO-проверка по расписанию — тем же способом, что и /api/cron/renew:
 * POST с заголовком x-cron-secret. Если нашлись новые серьёзные проблемы, письмо
 * уходит на ADMIN_NOTIFY_EMAIL (каждая проблема упоминается один раз).
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret") || "";
  const expected = process.env.CRON_SECRET || "";
  if (!expected || !safeCompare(secret, expected)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  try {
    const result = await runSeoAudit("cron");
    let digest = { sent: false, count: 0 };
    try {
      digest = await sendSeoDigest();
    } catch (e) {
      console.error("SEO-монитор: не удалось отправить письмо", e);
    }
    // Отложенные статьи, у которых наступило время выхода, тоже нужно сообщить Яндексу
    const indexNow = await pingPendingPosts("cron");
    return NextResponse.json({ ok: true, result, digest, indexNow });
  } catch (e) {
    console.error("SEO-монитор: ошибка проверки по расписанию", e);
    return NextResponse.json({ error: "Ошибка проверки" }, { status: 500 });
  }
}
