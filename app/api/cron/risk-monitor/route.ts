import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runCompetitorChecks, runSourceFetch } from "@/lib/monitorRun";
import { defaultDeps } from "@/lib/monitorStore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Ежедневный мониторинг для «Управления рисками»: ленты новостей и страницы конкурентов.
 *  POST с заголовком x-cron-secret (как /api/cron/renew). Раз в сутки достаточно. */
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret") || "";
  const expected = process.env.CRON_SECRET || "";
  if (!expected || !safeCompare(secret, expected)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  try {
    const deps = defaultDeps();
    const sources = await runSourceFetch(deps);
    const competitors = await runCompetitorChecks(deps, { limit: 40, budgetMs: 35_000 });
    return NextResponse.json({ ok: true, sources, competitors });
  } catch (e) {
    console.error("Мониторинг рисков: ошибка запуска по расписанию", e);
    return NextResponse.json({ error: "Ошибка мониторинга" }, { status: 500 });
  }
}
