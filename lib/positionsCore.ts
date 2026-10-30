// Позиции сайта по поисковым запросам — чистая логика (без базы), тесты: scripts/positions_test.ts

import { SearchEngineError, type QueryList } from "@/lib/searchEngines";

export type Engine = "yandex" | "google";
export const ENGINES: Engine[] = ["yandex", "google"];
export const ENGINE_LABEL: Record<Engine, string> = { yandex: "Яндекс", google: "Google" };

export const MAX_TARGETS = 100;
export const MAX_QUERY_LEN = 120;
/** Сколько запросов за день сохраняем от одной поисковой системы */
export const MAX_ROWS_PER_DAY = 500;
export const KEEP_DAYS = 400;
/** С какого прошлого дня сравниваем позицию (не позже, чем N дней назад от последних данных) */
export const COMPARE_DAYS = 7;

const MSK = 3 * 3600_000;
export const mskDayString = (d: Date): string => new Date(d.getTime() + MSK).toISOString().slice(0, 10);
const dayNum = (day: string): number => Math.floor(Date.parse(day + "T00:00:00Z") / 86400000);

/** Запрос в едином виде: строчные буквы, ё = е, без лишних пробелов */
export function normalizeQuery(q: unknown): string {
  if (typeof q !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return q.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/ё/gi, "е").replace(/\s+/g, " ").trim().toLowerCase().slice(0, MAX_QUERY_LEN);
}

/** Список запросов из текста: по одному в строке (или через «;»), без повторов */
export function parseTargetsInput(text: unknown, existing: string[] = []): { add: string[]; skipped: number; overLimit: boolean } {
  const seen = new Set(existing.map(normalizeQuery));
  const add: string[] = [];
  let skipped = 0;
  let overLimit = false;
  const parts = typeof text === "string" ? text.split(/[\n;]+/) : [];
  for (const raw of parts) {
    const q = normalizeQuery(raw);
    if (!q) continue;
    if (seen.has(q)) {
      skipped++;
      continue;
    }
    if (seen.size >= MAX_TARGETS) {
      overLimit = true;
      continue;
    }
    seen.add(q);
    add.push(q);
  }
  return { add, skipped, overLimit };
}

export interface PositionRow {
  engine: string;
  day: string;
  query: string;
  position: number;
  shows: number;
  clicks: number;
}
export interface TargetRow {
  id: string;
  query: string;
  note?: string;
}

export interface EngineCell {
  /** Дата данных (по Москве), к которой относится позиция */
  day: string;
  position: number;
  shows: number;
  clicks: number;
  /** Сдвиг к позиции неделю назад: положительное — поднялись (позиция стала ближе к первой) */
  change: number | null;
  /** Позиции по дням, от старых к новым (до 30 дней) */
  series: { day: string; position: number }[];
}
export interface TargetView {
  id: string;
  query: string;
  note: string;
  yandex: EngineCell | null;
  google: EngineCell | null;
}
export interface OtherQuery {
  query: string;
  position: number;
  shows: number;
  clicks: number;
  tracked: boolean;
}
export interface PositionsView {
  targets: TargetView[];
  others: Record<Engine, OtherQuery[]>;
  /** Дата последних загруженных данных по каждой системе */
  lastDay: Record<Engine, string | null>;
}

function cellFor(rows: PositionRow[]): EngineCell | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.day.localeCompare(b.day));
  const last = sorted[sorted.length - 1];
  // Для сравнения берём последний день не позже, чем COMPARE_DAYS назад от последних данных
  const limit = dayNum(last.day) - COMPARE_DAYS;
  let prev: PositionRow | null = null;
  for (const r of sorted) if (dayNum(r.day) <= limit) prev = r;
  return {
    day: last.day,
    position: last.position,
    shows: last.shows,
    clicks: last.clicks,
    change: prev ? Math.round((prev.position - last.position) * 10) / 10 : null,
    series: sorted.slice(-30).map((r) => ({ day: r.day, position: r.position })),
  };
}

/** Собирает для админки: свои запросы с позициями и динамикой + остальные запросы, по которым сайт показывается */
export function buildPositionsView(targets: TargetRow[], rows: PositionRow[], othersLimit = 50): PositionsView {
  const byEngineQuery = new Map<string, PositionRow[]>();
  const lastDay: Record<Engine, string | null> = { yandex: null, google: null };
  for (const r of rows) {
    if (r.engine !== "yandex" && r.engine !== "google") continue;
    const k = r.engine + "\u0001" + r.query;
    const list = byEngineQuery.get(k) ?? [];
    list.push(r);
    byEngineQuery.set(k, list);
    if (!lastDay[r.engine] || r.day > (lastDay[r.engine] as string)) lastDay[r.engine] = r.day;
  }
  const tracked = new Set(targets.map((t) => normalizeQuery(t.query)));
  const tv: TargetView[] = targets.map((t) => {
    const q = normalizeQuery(t.query);
    return {
      id: t.id,
      query: t.query,
      note: t.note ?? "",
      yandex: cellFor(byEngineQuery.get("yandex\u0001" + q) ?? []),
      google: cellFor(byEngineQuery.get("google\u0001" + q) ?? []),
    };
  });
  const others = { yandex: [] as OtherQuery[], google: [] as OtherQuery[] };
  for (const eng of ENGINES) {
    const day = lastDay[eng];
    if (!day) continue;
    others[eng] = rows
      .filter((r) => r.engine === eng && r.day === day)
      .sort((a, b) => b.shows - a.shows || a.position - b.position)
      .slice(0, othersLimit)
      .map((r) => ({ query: r.query, position: r.position, shows: r.shows, clicks: r.clicks, tracked: tracked.has(r.query) }));
  }
  return { targets: tv, others, lastDay };
}

/** Строки для сохранения: нормализованный запрос, самое большое число показов при повторах, не больше MAX_ROWS_PER_DAY */
export function prepareRows(
  list: { query: string; shows: number; clicks: number; position: number | null }[],
  mustKeep: Set<string> = new Set()
): { query: string; position: number; shows: number; clicks: number }[] {
  const m = new Map<string, { query: string; position: number; shows: number; clicks: number }>();
  for (const r of list) {
    const q = normalizeQuery(r.query);
    if (!q || r.position == null || !Number.isFinite(r.position) || r.position <= 0) continue;
    const prev = m.get(q);
    // Повторы (разный регистр/ё) складываем: показы и клики суммируются, позиция — по показам
    if (prev) {
      const total = prev.shows + r.shows;
      prev.position = total > 0 ? Math.round(((prev.position * prev.shows + r.position * r.shows) / total) * 10) / 10 : prev.position;
      prev.shows = total;
      prev.clicks += r.clicks;
    } else m.set(q, { query: q, position: Math.round(r.position * 10) / 10, shows: Math.max(0, Math.floor(r.shows)), clicks: Math.max(0, Math.floor(r.clicks)) });
  }
  const all = Array.from(m.values()).sort((a, b) => b.shows - a.shows);
  const head = all.slice(0, MAX_ROWS_PER_DAY);
  // Свои запросы сохраняем всегда, даже если по показам они не вошли в первые 500
  const extra = all.slice(MAX_ROWS_PER_DAY).filter((r) => mustKeep.has(r.query));
  return [...head, ...extra];
}

export interface CollectDeps {
  now: Date;
  targets: string[];
  /** Нет функции — система не подключена */
  yandex?: () => Promise<QueryList>;
  google?: () => Promise<QueryList>;
  save: (engine: Engine, day: string, rows: { query: string; position: number; shows: number; clicks: number }[]) => Promise<void>;
}
export interface CollectEngineResult {
  engine: Engine;
  status: "ok" | "not_connected" | "no_data" | "error";
  saved: number;
  message?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
}

/** Забирает запросы и позиции из подключённых систем и сохраняет снимок за сегодня. Ошибка одной системы не мешает другой, при сбое старые данные не стираются. */
export async function collectWith(deps: CollectDeps): Promise<CollectEngineResult[]> {
  const day = mskDayString(deps.now);
  const keep = new Set(deps.targets.map(normalizeQuery));
  const out: CollectEngineResult[] = [];
  for (const engine of ENGINES) {
    const fn = deps[engine];
    if (!fn) {
      out.push({ engine, status: "not_connected", saved: 0 });
      continue;
    }
    try {
      const list = await fn();
      const rows = prepareRows(list.queries, keep);
      if (rows.length === 0) {
        out.push({ engine, status: "no_data", saved: 0, dateFrom: list.dateFrom, dateTo: list.dateTo, message: "Система пока не отдаёт данные по запросам (для нового сайта это нормально, обычно 1–3 суток)." });
        continue;
      }
      await deps.save(engine, day, rows);
      out.push({ engine, status: "ok", saved: rows.length, dateFrom: list.dateFrom, dateTo: list.dateTo });
    } catch (e) {
      out.push({
        engine,
        status: "error",
        saved: 0,
        message: e instanceof SearchEngineError ? e.message : "Не удалось получить данные. Проверьте ключи и повторите.",
      });
    }
  }
  return out;
}

