import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRisksUser } from "@/lib/riskAccess";
import { triggerBackgroundRun } from "@/lib/monitorStore";
import { NEWS_SHOW_DAYS } from "@/lib/monitorCore";

export const dynamic = "force-dynamic";

/** Свежие записи из лент, добавленных администратором. Подбор под угрозы делает браузер по ключевым словам
 *  (данные о бизнесе пользователя на сервер для этого не отправляются). */
export async function GET() {
  const auth = await requireRisksUser();
  if ("error" in auth) return auth.error;
  triggerBackgroundRun();
  try {
    const since = new Date(Date.now() - NEWS_SHOW_DAYS * 86400000);
    const rows = (await (prisma as any).monitorItem.findMany({
      where: { publishedAt: { gte: since } },
      orderBy: { publishedAt: "desc" },
      take: 400,
      select: { id: true, title: true, link: true, summary: true, publishedAt: true, source: { select: { name: true } } },
    })) as { id: string; title: string; link: string; summary: string; publishedAt: Date; source: { name: string } }[];
    return NextResponse.json({
      items: rows.map((r) => ({ id: r.id, title: r.title, link: r.link, summary: r.summary, publishedAt: r.publishedAt, source: r.source?.name ?? "" })),
    });
  } catch (e) {
    console.error("Мониторинг рисков: не удалось прочитать новости (нужен prisma db push?)", e);
    return NextResponse.json({ items: [], needsDbPush: true });
  }
}
