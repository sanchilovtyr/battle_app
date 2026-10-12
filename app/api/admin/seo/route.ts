import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { runSeoAudit } from "@/lib/seoRun";
import { indexNowStatus } from "@/lib/indexnow";

export const dynamic = "force-dynamic";
// Обход страниц может занять до нескольких десятков секунд
export const maxDuration = 60;

const requireAdmin = () => verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value);

export async function GET() {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  try {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const [runs, issues, resolved] = await Promise.all([
      prisma.seoAuditRun.findMany({ orderBy: { ranAt: "desc" }, take: 12 }),
      prisma.seoIssue.findMany({ where: { status: { in: ["open", "snoozed", "ignored"] } } }),
      prisma.seoIssue.findMany({
        where: { status: "resolved", resolvedAt: { gte: since } },
        orderBy: { resolvedAt: "desc" },
        take: 20,
        select: { id: true, title: true, severity: true, resolvedAt: true },
      }),
    ]);
    // Визиты роботов читаем отдельно: если таблицы ещё нет, остальной монитор должен работать
    let bots: unknown[] = [];
    try {
      bots = await prisma.botVisit.findMany({ orderBy: { lastSeenAt: "desc" } });
    } catch {
      // нужен prisma db push
    }
    const indexNow = await indexNowStatus();
    return NextResponse.json({ runs, issues, resolved, bots, indexNow });
  } catch (e) {
    console.error("SEO-монитор: не удалось прочитать данные", e);
    return NextResponse.json({ runs: [], issues: [], resolved: [], needsDbPush: true });
  }
}

export async function POST() {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  try {
    const result = await runSeoAudit("manual");
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("SEO-монитор: ошибка проверки", e);
    return NextResponse.json({ error: "Не удалось выполнить проверку. Если вы только что обновили код, выполните npx prisma db push." }, { status: 500 });
  }
}
