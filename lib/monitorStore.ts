// Подключение мониторинга к базе и сети (только сервер). Логика — в lib/monitorRun.ts.

import { prisma } from "@/lib/db";
import { runCompetitorChecks, runSourceFetch, type CompetitorRow, type MonitorDeps, type MonitorStore } from "./monitorRun";
import { safeGet } from "./safeFetch";

// Prisma-клиент в песочнице не генерируется, поэтому новые модели обращаются через any
const db = prisma as any;

const toRow = (c: any): CompetitorRow => ({
  id: c.id,
  businessId: c.businessId,
  name: c.name,
  url: c.url,
  snapshotText: c.snapshotText ?? "",
  snapshotAt: c.snapshotAt ?? null,
});

export const prismaStore: MonitorStore = {
  async enabledSources() {
    return (await db.monitorSource.findMany({ where: { enabled: true }, select: { id: true, name: true, url: true } })) as { id: string; name: string; url: string }[];
  },
  async saveSourceResult(id, r) {
    await db.monitorSource.update({
      where: { id },
      data: { lastFetchedAt: r.at, lastStatus: r.ok ? "ok" : "error", lastError: r.error, lastItems: r.items },
    });
  },
  async saveItems(sourceId, items) {
    if (items.length === 0) return 0;
    const res = await db.monitorItem.createMany({ data: items.map((i) => ({ sourceId, ...i })), skipDuplicates: true });
    return (res?.count as number) ?? 0;
  },
  async deleteOldItems(before) {
    const res = await db.monitorItem.deleteMany({ where: { publishedAt: { lt: before } } });
    return (res?.count as number) ?? 0;
  },
  async dueCompetitors(checkedBefore, limit) {
    const rows = await db.competitor.findMany({
      where: { OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: checkedBefore } }] },
      orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }],
      take: limit,
    });
    return (rows as any[]).map(toRow);
  },
  async competitorsByIds(ids) {
    if (ids.length === 0) return [];
    return ((await db.competitor.findMany({ where: { id: { in: ids } } })) as any[]).map(toRow);
  },
  async saveCompetitorResult(id, r) {
    await db.competitor.update({
      where: { id },
      data: {
        lastCheckedAt: r.at,
        lastStatus: r.status,
        lastError: r.error,
        ...(r.snapshot ? { snapshotTitle: r.snapshot.title, snapshotText: r.snapshot.text, snapshotAt: r.at } : {}),
      },
    });
  },
  async addChange(c) {
    await db.competitorChange.create({
      data: { competitorId: c.competitorId, businessId: c.businessId, added: c.added, removed: c.removed, large: c.large, detectedAt: c.at },
    });
    // Храним историю не дольше 120 дней
    await db.competitorChange.deleteMany({ where: { competitorId: c.competitorId, detectedAt: { lt: new Date(c.at.getTime() - 120 * 86400000) } } });
  },
};

export const defaultDeps = (): MonitorDeps => ({ store: prismaStore, get: safeGet, now: () => new Date() });

let lastBackgroundRun = 0;
let running = false;

/**
 * Запасной запуск без расписания: если мониторинг не запускали больше 12 часов, при заходе
 * пользователя «Премиума» в раздел рисков он стартует в фоне. Основной способ — cron
 * (/api/cron/risk-monitor); этот нужен, чтобы раздел не «засыпал», если cron забыли настроить.
 */
export function triggerBackgroundRun(): boolean {
  const now = Date.now();
  if (running || now - lastBackgroundRun < 12 * 3600 * 1000) return false;
  running = true;
  lastBackgroundRun = now;
  const deps = defaultDeps();
  void (async () => {
    try {
      await runSourceFetch(deps);
      await runCompetitorChecks(deps, { limit: 20, budgetMs: 40_000 });
    } catch (e) {
      console.error("Мониторинг рисков: фоновый запуск не удался", e);
    } finally {
      running = false;
    }
  })();
  return true;
}
