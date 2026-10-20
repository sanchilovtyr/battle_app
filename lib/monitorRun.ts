// Запуск мониторинга: ленты новостей и страницы конкурентов.
// Логика не знает ни о базе, ни о сети: хранилище и загрузчик подставляются снаружи
// (в проде — Prisma и safeGet, в тестах — память и подделка), поэтому она проверяется без сервера.

import { createHash } from "crypto";
import {
  CHECK_EVERY_HOURS,
  NEWS_KEEP_DAYS,
  diffLines,
  pageSnapshot,
  parseFeed,
  robotsAllows,
  snapshotToText,
  textToLines,
} from "./monitorCore";
import { parsePublicUrl, type FetchOptions, type FetchResult } from "./safeFetch";

export interface SourceRow {
  id: string;
  name: string;
  url: string;
}

export interface CompetitorRow {
  id: string;
  businessId: string;
  name: string;
  url: string;
  snapshotText: string;
  snapshotAt: Date | null;
}

export interface NewItem {
  linkHash: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: Date;
}

export interface CompetitorResult {
  status: "ok" | "error" | "robots";
  error: string;
  /** Новый снимок страницы; null — оставить прежний. */
  snapshot: { title: string; text: string } | null;
}

export interface MonitorStore {
  enabledSources(): Promise<SourceRow[]>;
  saveSourceResult(id: string, r: { ok: boolean; error: string; items: number; at: Date }): Promise<void>;
  saveItems(sourceId: string, items: NewItem[]): Promise<number>;
  deleteOldItems(before: Date): Promise<number>;
  dueCompetitors(checkedBefore: Date, limit: number): Promise<CompetitorRow[]>;
  competitorsByIds(ids: string[]): Promise<CompetitorRow[]>;
  saveCompetitorResult(id: string, r: CompetitorResult & { at: Date }): Promise<void>;
  addChange(c: { competitorId: string; businessId: string; added: string[]; removed: string[]; large: boolean; at: Date }): Promise<void>;
}

export interface MonitorDeps {
  store: MonitorStore;
  get: (url: string, opts?: FetchOptions) => Promise<FetchResult>;
  now: () => Date;
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

const errText = (e: unknown, fallback: string): string => (e instanceof Error && e.message ? e.message.slice(0, 200) : fallback);

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

// ───────────────────────── ленты ─────────────────────────

export async function fetchFeed(deps: Pick<MonitorDeps, "get" | "now">, url: string): Promise<{ ok: true; items: ReturnType<typeof parseFeed> } | { ok: false; error: string }> {
  try {
    const res = await deps.get(url, { accept: "application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.5", maxBytes: 2_000_000 });
    if (res.status < 200 || res.status >= 300) return { ok: false, error: `Лента ответила ошибкой ${res.status}` };
    const items = parseFeed(res.body, deps.now());
    if (items.length === 0) return { ok: false, error: "В ленте не нашлось записей: проверьте, что это адрес RSS или Atom" };
    return { ok: true, items };
  } catch (e) {
    return { ok: false, error: errText(e, "Не удалось загрузить ленту") };
  }
}

export interface SourcesRunResult {
  sources: number;
  failed: number;
  newItems: number;
  removed: number;
}

export async function runSourceFetch(deps: MonitorDeps): Promise<SourcesRunResult> {
  const sources = await deps.store.enabledSources();
  let failed = 0;
  let newItems = 0;
  await mapLimit(sources, 4, async (s) => {
    const r = await fetchFeed(deps, s.url);
    const at = deps.now();
    if (!r.ok) {
      failed++;
      await deps.store.saveSourceResult(s.id, { ok: false, error: r.error, items: 0, at });
      return;
    }
    const items: NewItem[] = r.items.map((i) => ({ linkHash: hash(i.link), title: i.title, link: i.link, summary: i.summary, publishedAt: i.publishedAt }));
    const added = await deps.store.saveItems(s.id, items);
    newItems += added;
    await deps.store.saveSourceResult(s.id, { ok: true, error: "", items: items.length, at });
  });
  const removed = await deps.store.deleteOldItems(new Date(deps.now().getTime() - NEWS_KEEP_DAYS * 86400000));
  return { sources: sources.length, failed, newItems, removed };
}

// ───────────────────────── конкуренты ─────────────────────────

export type RobotsCache = Map<string, string | null>;

async function robotsFor(deps: Pick<MonitorDeps, "get">, url: URL, cache: RobotsCache): Promise<string | null> {
  const origin = url.origin;
  if (cache.has(origin)) return cache.get(origin) ?? null;
  let text: string | null = null;
  try {
    const r = await deps.get(`${origin}/robots.txt`, { accept: "text/plain,*/*;q=0.5", maxBytes: 200_000, timeoutMs: 6000 });
    if (r.status >= 200 && r.status < 300 && !/html/i.test(r.contentType)) text = r.body;
  } catch {
    text = null; // robots.txt недоступен — считаем, что ограничений нет
  }
  cache.set(origin, text);
  return text;
}

/** Проверяет одну страницу. Возвращает результат и, если нужно, найденные изменения (хранилище здесь не трогаем). */
export async function checkCompetitorPage(
  deps: Pick<MonitorDeps, "get">,
  row: Pick<CompetitorRow, "url" | "snapshotText" | "snapshotAt">,
  robots: RobotsCache
): Promise<{ result: CompetitorResult; diff: ReturnType<typeof diffLines> }> {
  const none = { snapshot: null };
  const parsed = parsePublicUrl(row.url);
  if (!parsed.ok) return { result: { status: "error", error: parsed.reason, ...none }, diff: null };
  const robotsTxt = await robotsFor(deps, parsed.url, robots);
  if (robotsTxt !== null && !robotsAllows(robotsTxt, parsed.url.pathname + parsed.url.search)) {
    return { result: { status: "robots", error: "Сайт запретил автоматическую проверку этой страницы (robots.txt). Следите за ним вручную.", ...none }, diff: null };
  }
  let res: FetchResult;
  try {
    res = await deps.get(row.url);
  } catch (e) {
    return { result: { status: "error", error: errText(e, "Не удалось загрузить страницу"), ...none }, diff: null };
  }
  if (res.status < 200 || res.status >= 300) {
    return { result: { status: "error", error: `Сайт ответил ошибкой ${res.status}`, ...none }, diff: null };
  }
  if (res.contentType && !/html|xml|text/i.test(res.contentType)) {
    return { result: { status: "error", error: "По этому адресу не веб-страница", ...none }, diff: null };
  }
  const snap = pageSnapshot(res.body);
  if (snap.lines.length < 3) {
    return { result: { status: "error", error: "На странице почти нет текста: возможно, она строится скриптами и не читается автоматически", ...none }, diff: null };
  }
  const text = snapshotToText(snap.lines);
  const hadBaseline = !!row.snapshotAt && row.snapshotText.length > 0;
  const diff = hadBaseline ? diffLines(textToLines(row.snapshotText), textToLines(text)) : null;
  return { result: { status: "ok", error: "", snapshot: { title: snap.title, text } }, diff };
}

export interface CompetitorsRunResult {
  checked: number;
  changed: number;
  failed: number;
  skippedByBudget: number;
}

async function runRows(deps: MonitorDeps, rows: CompetitorRow[], budgetMs: number): Promise<CompetitorsRunResult> {
  const started = deps.now().getTime();
  const robots: RobotsCache = new Map();
  let checked = 0;
  let changed = 0;
  let failed = 0;
  let skipped = 0;
  await mapLimit(rows, 4, async (row) => {
    if (deps.now().getTime() - started > budgetMs) {
      skipped++;
      return;
    }
    const { result, diff } = await checkCompetitorPage(deps, row, robots);
    const at = deps.now();
    checked++;
    if (result.status !== "ok") failed++;
    await deps.store.saveCompetitorResult(row.id, { ...result, at });
    if (diff) {
      changed++;
      await deps.store.addChange({ competitorId: row.id, businessId: row.businessId, added: diff.added, removed: diff.removed, large: diff.large, at });
    }
  });
  return { checked, changed, failed, skippedByBudget: skipped };
}

/** Плановая проверка: страницы, которые не проверяли дольше CHECK_EVERY_HOURS, самые давние первыми. */
export async function runCompetitorChecks(deps: MonitorDeps, opts: { limit?: number; budgetMs?: number } = {}): Promise<CompetitorsRunResult> {
  const before = new Date(deps.now().getTime() - CHECK_EVERY_HOURS * 3600000);
  const rows = await deps.store.dueCompetitors(before, opts.limit ?? 40);
  return runRows(deps, rows, opts.budgetMs ?? 40_000);
}

/** Проверка выбранных страниц (кнопка «Проверить сейчас» и первая проверка после добавления). */
export async function checkCompetitorsNow(deps: MonitorDeps, ids: string[], budgetMs = 25_000): Promise<CompetitorsRunResult> {
  const rows = await deps.store.competitorsByIds(ids);
  return runRows(deps, rows, budgetMs);
}
