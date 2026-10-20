import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRisksUser, tooManyActions } from "@/lib/riskAccess";
import { checkCompetitorsNow } from "@/lib/monitorRun";
import { defaultDeps } from "@/lib/monitorStore";
import { MANUAL_COOLDOWN_MIN, MAX_COMPETITORS_PER_BUSINESS } from "@/lib/monitorCore";
import { parsePublicUrl } from "@/lib/safeFetch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const db = prisma as any;

async function ownedBusiness(userId: string, businessId: unknown): Promise<string | null> {
  if (typeof businessId !== "string" || !/^[A-Za-z0-9_-]{6,64}$/.test(businessId)) return null;
  const b = await db.business.findFirst({ where: { id: businessId, userId }, select: { id: true } });
  return b ? (b.id as string) : null;
}

async function snapshotState(businessId: string) {
  const competitors = (await db.competitor.findMany({
    where: { businessId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, url: true, lastCheckedAt: true, lastStatus: true, lastError: true, snapshotAt: true },
  })) as { id: string; name: string; url: string; lastCheckedAt: Date | null; lastStatus: string; lastError: string; snapshotAt: Date | null }[];
  const changes = (await db.competitorChange.findMany({
    where: { businessId },
    orderBy: { detectedAt: "desc" },
    take: 20,
    select: { id: true, competitorId: true, detectedAt: true, added: true, removed: true, large: true, seen: true },
  })) as unknown[];
  return {
    competitors: competitors.map((c) => ({ id: c.id, name: c.name, url: c.url, lastCheckedAt: c.lastCheckedAt, status: c.lastStatus, error: c.lastError, hasBaseline: !!c.snapshotAt })),
    changes,
    limit: MAX_COMPETITORS_PER_BUSINESS,
  };
}

export async function GET(req: Request) {
  const auth = await requireRisksUser();
  if ("error" in auth) return auth.error;
  const businessId = await ownedBusiness(auth.user.id, new URL(req.url).searchParams.get("businessId"));
  if (!businessId) return NextResponse.json({ competitors: [], changes: [], limit: MAX_COMPETITORS_PER_BUSINESS, notSynced: true });
  try {
    return NextResponse.json(await snapshotState(businessId));
  } catch (e) {
    console.error("Мониторинг конкурентов: не удалось прочитать данные (нужен prisma db push?)", e);
    return NextResponse.json({ competitors: [], changes: [], limit: MAX_COMPETITORS_PER_BUSINESS, needsDbPush: true });
  }
}

/** action: add (name, url) | check | seen (ids) | remove (id) */
export async function POST(req: Request) {
  const auth = await requireRisksUser();
  if ("error" in auth) return auth.error;
  if (tooManyActions(auth.user.id)) return NextResponse.json({ error: "Слишком много действий подряд, подождите минуту" }, { status: 429 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const businessId = await ownedBusiness(auth.user.id, body.businessId);
  if (!businessId) return NextResponse.json({ error: "Бизнес ещё не сохранён на сервере. Обновите страницу и попробуйте снова." }, { status: 404 });

  try {
    if (body.action === "add") {
      const check = parsePublicUrl(body.url);
      if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });
      const count = await db.competitor.count({ where: { businessId } });
      if (count >= MAX_COMPETITORS_PER_BUSINESS) {
        return NextResponse.json({ error: `Можно следить не больше чем за ${MAX_COMPETITORS_PER_BUSINESS} конкурентами` }, { status: 400 });
      }
      const url = check.url.toString();
      if (await db.competitor.findFirst({ where: { businessId, url }, select: { id: true } })) {
        return NextResponse.json({ error: "Этот адрес уже добавлен" }, { status: 400 });
      }
      const name = (typeof body.name === "string" ? body.name.trim() : "").slice(0, 80) || check.url.hostname.replace(/^www\./, "");
      const created = await db.competitor.create({ data: { businessId, name, url } });
      await checkCompetitorsNow(defaultDeps(), [created.id], 20_000); // первая проверка — снимок «как было»
    } else if (body.action === "check") {
      const cutoff = Date.now() - MANUAL_COOLDOWN_MIN * 60_000;
      const rows = (await db.competitor.findMany({ where: { businessId }, select: { id: true, lastCheckedAt: true } })) as { id: string; lastCheckedAt: Date | null }[];
      const ids = rows.filter((r) => !r.lastCheckedAt || r.lastCheckedAt.getTime() < cutoff).map((r) => r.id);
      if (ids.length === 0) {
        return NextResponse.json({ ...(await snapshotState(businessId)), notice: `Страницы уже проверялись недавно. Повторная проверка доступна через ${MANUAL_COOLDOWN_MIN} минут.` });
      }
      await checkCompetitorsNow(defaultDeps(), ids);
    } else if (body.action === "seen") {
      const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 50) : [];
      if (ids.length) await db.competitorChange.updateMany({ where: { businessId, id: { in: ids } }, data: { seen: true } });
    } else if (body.action === "remove") {
      if (typeof body.id !== "string") return NextResponse.json({ error: "Не указан конкурент" }, { status: 400 });
      await db.competitor.deleteMany({ where: { id: body.id, businessId } });
    } else {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }
    return NextResponse.json(await snapshotState(businessId));
  } catch (e) {
    console.error("Мониторинг конкурентов: ошибка", e);
    return NextResponse.json({ error: "Не удалось выполнить действие. Если вы только что обновили код, выполните npx prisma db push." }, { status: 500 });
  }
}
