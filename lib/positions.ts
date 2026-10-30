import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/blog";
import { getKey } from "@/lib/integrationKeys";
import { fetchGoogleQueryList, fetchYandexQueryList, normalizePem } from "@/lib/searchEngines";
import {
  collectWith,
  type CollectEngineResult,
  Engine,
  ENGINES,
  KEEP_DAYS,
  MAX_QUERY_LEN,
  PositionRow,
  PositionsView,
  TargetRow,
  buildPositionsView,
  mskDayString,
  normalizeQuery,
  parseTargetsInput,
  prepareRows,
} from "@/lib/positionsCore";

// Модели добавлены после последней генерации клиента Prisma — через any (после `prisma generate` типы подтянутся)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

async function saveRows(engine: Engine, day: string, rows: { query: string; position: number; shows: number; clicks: number }[]) {
  await db.seoPosition.deleteMany({ where: { engine, day } });
  await db.seoPosition.createMany({ data: rows.map((r) => ({ engine, day, ...r })), skipDuplicates: true });
}

export async function listTargets(): Promise<TargetRow[]> {
  const rows = (await db.seoTargetQuery.findMany({ orderBy: { createdAt: "asc" }, take: 500 })) as { id: string; query: string; note: string }[];
  return rows.map((r) => ({ id: r.id, query: r.query, note: r.note ?? "" }));
}

/** Загрузка из подключённых систем с ключами из админки или окружения */
export async function collectPositions(now = new Date()): Promise<CollectEngineResult[]> {
  const targets = (await listTargets().catch(() => [])).map((t) => t.query);
  const yToken = (await getKey("YANDEX_WEBMASTER_TOKEN")).value;
  const yHost = (await getKey("YANDEX_WEBMASTER_HOST")).value;
  const gEmail = (await getKey("GOOGLE_SC_CLIENT_EMAIL")).value;
  const gKey = (await getKey("GOOGLE_SC_PRIVATE_KEY")).value;
  const gSite = (await getKey("GOOGLE_SC_SITE_URL")).value || `${SITE_URL}/`;
  return collectWith({
    now,
    targets,
    yandex: yToken ? () => fetchYandexQueryList(yToken, SITE_URL, yHost || undefined) : undefined,
    google: gEmail && gKey ? () => fetchGoogleQueryList({ clientEmail: gEmail, privateKey: normalizePem(gKey) }, gSite, fetch, now) : undefined,
    save: saveRows,
  });
}

export async function loadPositionsView(now = new Date()): Promise<PositionsView & { connected: Record<Engine, boolean> }> {
  const targets = await listTargets();
  const from = mskDayString(new Date(now.getTime() - 35 * 86400000));
  const queries = targets.map((t) => normalizeQuery(t.query));
  const rows: PositionRow[] = [];
  if (queries.length) {
    rows.push(...((await db.seoPosition.findMany({ where: { query: { in: queries }, day: { gte: from } }, take: 20000 })) as PositionRow[]));
  }
  // Остальные запросы — за последний загруженный день каждой системы
  for (const engine of ENGINES) {
    const last = (await db.seoPosition.findFirst({ where: { engine }, orderBy: { day: "desc" }, select: { day: true } })) as { day: string } | null;
    if (!last) continue;
    const top = (await db.seoPosition.findMany({ where: { engine, day: last.day }, orderBy: { shows: "desc" }, take: 300 })) as PositionRow[];
    for (const r of top) if (!rows.some((x) => x.engine === r.engine && x.day === r.day && x.query === r.query)) rows.push(r);
  }
  const view = buildPositionsView(targets, rows, 50);
  const yToken = (await getKey("YANDEX_WEBMASTER_TOKEN")).value;
  const gEmail = (await getKey("GOOGLE_SC_CLIENT_EMAIL")).value;
  const gKey = (await getKey("GOOGLE_SC_PRIVATE_KEY")).value;
  return { ...view, connected: { yandex: !!yToken, google: !!(gEmail && gKey) } };
}

export async function addTargets(text: unknown): Promise<{ added: number; skipped: number; overLimit: boolean }> {
  const existing = (await listTargets()).map((t) => t.query);
  const { add, skipped, overLimit } = parseTargetsInput(text, existing);
  for (const q of add) {
    try {
      await db.seoTargetQuery.create({ data: { query: q.slice(0, MAX_QUERY_LEN) } });
    } catch {
      // такой запрос добавили параллельно
    }
  }
  return { added: add.length, skipped, overLimit };
}

export async function removeTarget(id: unknown): Promise<void> {
  if (typeof id !== "string" || !id) return;
  await db.seoTargetQuery.deleteMany({ where: { id } });
}

export async function updateTargetNote(id: unknown, note: unknown): Promise<void> {
  if (typeof id !== "string" || !id) return;
  const n = typeof note === "string" ? note.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  await db.seoTargetQuery.updateMany({ where: { id }, data: { note: n } });
}

/** Чистка старых снимков (вызывается из ежедневной проверки) */
export async function prunePositions(now = new Date()): Promise<void> {
  try {
    await db.seoPosition.deleteMany({ where: { day: { lt: mskDayString(new Date(now.getTime() - KEEP_DAYS * 86400000)) } } });
  } catch {
    /* таблицы может ещё не быть */
  }
}
