// Промокоды: скидка на первый месяц тарифа «Премиум» для пользователей на бесплатном тарифе.
// Чистые функции (без базы и сети): проверяются тестами scripts/promo_test.ts.

import type { PlanId } from "./plans";

export const PROMO_PLAN_ID: PlanId = "agency";
export const PROMO_PERIOD_DAYS = 30;
export const MAX_PROMO_PERCENT = 100;
export const MIN_CODE_LEN = 3;
export const MAX_CODE_LEN = 32;

/** Регистр, пробелы и дефисные варианты не важны: «лето-2026», «ЛЕТО 2026» и «Лето2026» — разные записи только по символам. */
export function normalizeCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.normalize("NFKC").trim().toUpperCase().replace(/\s+/g, "").replace(/[‐‑–—−]/g, "-");
}

export function isValidCode(code: string): boolean {
  return code.length >= MIN_CODE_LEN && code.length <= MAX_CODE_LEN && /^[A-ZА-ЯЁ0-9_-]+$/.test(code);
}

export interface PromoPrice {
  originalRub: number;
  finalRub: number;
  discountRub: number;
  /** 100%: платёж не нужен, месяц выдаётся без списания и без автопродления */
  free: boolean;
}

/** Цена с учётом скидки в целых рублях. При скидке меньше 100% платить нужно минимум 1 ₽ (ЮKassa не принимает 0). */
export function priceWithPromo(originalRub: number, percent: number): PromoPrice {
  const p = Math.min(MAX_PROMO_PERCENT, Math.max(0, Math.round(percent)));
  const orig = Math.max(0, Math.round(originalRub));
  if (p >= 100) return { originalRub: orig, finalRub: 0, discountRub: orig, free: true };
  const final = Math.max(1, Math.round((orig * (100 - p)) / 100));
  return { originalRub: orig, finalRub: Math.min(final, orig || 1), discountRub: Math.max(0, orig - final), free: false };
}

export interface PromoLike {
  active: boolean;
  percent: number;
  planId: string;
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
}

export type PromoVerdict =
  | { ok: true }
  | { ok: false; code: "unknown" | "not_free_plan" | "wrong_plan" | "already_used"; message: string };

export const GENERIC_PROMO_ERROR = "Промокод не найден или больше не действует";

/** Можно ли применить промокод. Причины «не найден», «выключен», «истёк», «закончился» намеренно не различаются: так код нельзя подбирать. */
export function evaluatePromo(
  promo: PromoLike | null,
  ctx: { now: Date; planId: string; effectivePlanId: string; alreadyUsedByUser: boolean }
): PromoVerdict {
  if (!promo || !promo.active) return { ok: false, code: "unknown", message: GENERIC_PROMO_ERROR };
  if (promo.expiresAt && promo.expiresAt.getTime() <= ctx.now.getTime()) return { ok: false, code: "unknown", message: GENERIC_PROMO_ERROR };
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) return { ok: false, code: "unknown", message: GENERIC_PROMO_ERROR };
  if (ctx.alreadyUsedByUser) return { ok: false, code: "already_used", message: "Вы уже использовали этот промокод" };
  if (ctx.planId !== promo.planId) return { ok: false, code: "wrong_plan", message: "Этот промокод действует только на тариф «Премиум»" };
  if (ctx.effectivePlanId !== "trial") return { ok: false, code: "not_free_plan", message: "Промокод действует для пользователей на бесплатном тарифе" };
  return { ok: true };
}

// ───────────────────────── админка ─────────────────────────

export interface PromoInput {
  code: string;
  percent: number;
  expiresAt: Date | null;
  maxUses: number | null;
  note: string;
}

export function parsePromoInput(raw: unknown, now: Date): { ok: true; value: PromoInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Некорректный запрос" };
  const r = raw as Record<string, unknown>;
  const code = normalizeCode(r.code);
  if (!isValidCode(code)) return { ok: false, error: `Код: от ${MIN_CODE_LEN} до ${MAX_CODE_LEN} символов, буквы, цифры, «-» и «_»` };
  const percent = Number(r.percent);
  if (!Number.isInteger(percent) || percent < 1 || percent > MAX_PROMO_PERCENT) return { ok: false, error: "Скидка: целое число от 1 до 100 процентов" };
  let expiresAt: Date | null = null;
  if (r.expiresAt !== undefined && r.expiresAt !== null && r.expiresAt !== "") {
    const s = String(r.expiresAt);
    // «ГГГГ-ММ-ДД» — действует весь этот день по московскому времени
    const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T23:59:59+03:00`) : new Date(s);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Не удалось разобрать дату окончания" };
    if (d.getTime() <= now.getTime()) return { ok: false, error: "Дата окончания уже прошла" };
    expiresAt = d;
  }
  let maxUses: number | null = null;
  if (r.maxUses !== undefined && r.maxUses !== null && r.maxUses !== "") {
    const m = Number(r.maxUses);
    if (!Number.isInteger(m) || m < 1 || m > 100000) return { ok: false, error: "Лимит использований: целое число от 1 до 100 000" };
    maxUses = m;
  }
  const note = typeof r.note === "string" ? r.note.trim().slice(0, 200) : "";
  return { ok: true, value: { code, percent, expiresAt, maxUses, note } };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** Читаемый случайный код без путаницы 0/O и 1/I: например «K7M2-9QXA». */
export function generateCode(rand: () => number = Math.random): string {
  const pick = () => CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return Array.from({ length: 4 }, pick).join("") + "-" + Array.from({ length: 4 }, pick).join("");
}

/** Текст для пользователя о том, как работает скидка. */
export function promoSummary(p: PromoPrice, percent: number, regularPrice: string): string {
  const fmt = (n: number) => n.toLocaleString("ru-RU").replace(/ /g, " ");
  if (p.free) return "Первый месяц бесплатно, без списания с карты. Автопродление не включится: чтобы продолжить, оформите подписку по окончании месяца.";
  return `Скидка ${percent}% действует на первый месяц: ${fmt(p.finalRub)} ₽ вместо ${fmt(p.originalRub)} ₽. Со второго месяца подписка продлевается по обычной цене ${regularPrice}/мес, отменить можно в любой момент в личном кабинете.`;
}
