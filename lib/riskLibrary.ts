// Библиотека типовых угроз: встроенные записи (lib/risksCore.ts) + правки и новые записи администратора.
// Пользователь только выбирает записи из библиотеки: менять её может лишь администратор (вкладка «Типовые угрозы»).
// Чистые функции без базы: проверяются в scripts/risk_library_test.ts.

import { BUSINESS_TYPE_LABELS } from "./businessTypes";
import {
  NICHE_RISKS,
  REVIEW_PERIODS,
  RISK_CATEGORIES,
  UNIVERSAL_RISKS,
  clampPeriod,
  clampScale,
  type RiskCategory,
  type RiskTemplate,
} from "./risksCore";
import { parseKeywords } from "./monitorCore";

export const BUSINESS_TYPE_KEYS = Object.keys(BUSINESS_TYPE_LABELS);
export const MAX_CUSTOM_TEMPLATES = 100;

export interface LibraryEntry extends RiskTemplate {
  /** Для каких типов бизнеса показывать; пусто — для всех. */
  types: string[];
  builtin: boolean;
  hidden: boolean;
  /** Встроенная запись, изменённая администратором. */
  edited: boolean;
}

/** Строка из базы: правка встроенной записи (builtin) или новая запись администратора. */
export interface TemplateRow {
  id: string;
  builtin: boolean;
  hidden: boolean;
  title: string;
  category: string;
  what: string;
  signal: string;
  measures: string;
  plan: string;
  probability: number;
  impact: number;
  every: number;
  keywords: string;
  types: string[];
}

export function builtinEntries(): LibraryEntry[] {
  const out: LibraryEntry[] = UNIVERSAL_RISKS.map((t) => ({ ...t, types: [], builtin: true, hidden: false, edited: false }));
  for (const [type, list] of Object.entries(NICHE_RISKS)) {
    for (const t of list) out.push({ ...t, types: [type], builtin: true, hidden: false, edited: false });
  }
  return out;
}

/** Встроенные записи с правками и скрытием + записи администратора. Порядок: встроенные, затем свои. */
export function mergeLibrary(rows: TemplateRow[]): LibraryEntry[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const merged = builtinEntries().map((b) => {
    const o = byId.get(b.id);
    if (!o) return b;
    const hasContent = !!o.title;
    return {
      ...b,
      ...(hasContent
        ? {
            title: o.title,
            category: (RISK_CATEGORIES as readonly string[]).includes(o.category) ? (o.category as RiskCategory) : b.category,
            what: o.what,
            signal: o.signal,
            measures: o.measures,
            plan: o.plan,
            probability: clampScale(o.probability),
            impact: clampScale(o.impact),
            every: clampPeriod(o.every),
            keywords: o.keywords || b.keywords,
          }
        : {}),
      hidden: o.hidden,
      edited: hasContent,
    };
  });
  const customs: LibraryEntry[] = rows
    .filter((r) => !r.builtin)
    .map((r) => ({
      id: r.id,
      title: r.title,
      category: (RISK_CATEGORIES as readonly string[]).includes(r.category) ? (r.category as RiskCategory) : "economy",
      what: r.what,
      signal: r.signal,
      measures: r.measures,
      plan: r.plan,
      probability: clampScale(r.probability),
      impact: clampScale(r.impact),
      every: clampPeriod(r.every),
      keywords: r.keywords || undefined,
      types: r.types.filter((t) => BUSINESS_TYPE_KEYS.includes(t)),
      builtin: false,
      hidden: r.hidden,
      edited: false,
    }));
  return [...merged, ...customs];
}

/** Ключ типа бизнеса из ключа или подписи («Услуги»); неизвестное — «other». */
export function resolveTypeKey(businessType: string | undefined | null): string {
  if (businessType && BUSINESS_TYPE_KEYS.includes(businessType)) return businessType;
  return BUSINESS_TYPE_KEYS.find((k) => BUSINESS_TYPE_LABELS[k] === businessType) ?? "other";
}

/** Что видит пользователь: не скрытые записи для всех типов и для его типа. */
export function libraryForBusiness(entries: LibraryEntry[], businessType: string | undefined | null): RiskTemplate[] {
  const key = resolveTypeKey(businessType);
  return entries
    .filter((e) => !e.hidden && (e.types.length === 0 || e.types.includes(key)))
    .map(({ types: _types, builtin: _b, hidden: _h, edited: _e, ...tpl }) => tpl);
}

// ───────────────────────── проверка ввода администратора ─────────────────────────

const clip = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

export type TemplateInput = Omit<TemplateRow, "id" | "builtin" | "hidden">;

export function parseTemplateInput(raw: unknown): { ok: true; value: TemplateInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Некорректный запрос" };
  const r = raw as Record<string, unknown>;
  const title = clip(r.title, 200);
  if (title.length < 5) return { ok: false, error: "Название угрозы: не короче 5 символов" };
  if (!(RISK_CATEGORIES as readonly string[]).includes(String(r.category))) return { ok: false, error: "Выберите категорию" };
  const every = Number(r.every);
  if (!REVIEW_PERIODS.includes(every)) return { ok: false, error: "Периодичность проверки: 7, 14, 30, 60 или 90 дней" };
  const prob = Number(r.probability);
  const imp = Number(r.impact);
  if (![prob, imp].every((n) => Number.isInteger(n) && n >= 1 && n <= 5)) return { ok: false, error: "Вероятность и влияние: числа от 1 до 5" };
  const types = Array.isArray(r.types) ? [...new Set(r.types.filter((x): x is string => typeof x === "string" && BUSINESS_TYPE_KEYS.includes(x)))] : [];
  // Ключевые слова нормализуются тем же разбором, что и при подборе новостей
  const keywords = parseKeywords(clip(r.keywords, 300)).join(", ");
  return {
    ok: true,
    value: {
      title,
      category: String(r.category),
      what: clip(r.what, 400),
      signal: clip(r.signal, 600),
      measures: clip(r.measures, 1500),
      plan: clip(r.plan, 1500),
      probability: prob,
      impact: imp,
      every,
      keywords,
      types,
    },
  };
}
