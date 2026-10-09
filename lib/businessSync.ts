// Чистые функции проверки данных бизнеса при сохранении на сервере
// (используются в app/api/businesses/*, покрыты тестами в scripts/seo_test.ts).
// Клиентскому JSON не доверяем: оставляем только известные поля, режем размеры.

import type { GeneratedPlan } from "./types";
import { isPlanSizeReasonable } from "./planValidation";

export const MAX_BUSINESSES_PER_USER = 25;
export const MAX_BODY_BYTES = 600_000;
const MAX_SNAPSHOTS = 24;
const MAX_PROGRESS = 180;
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

export function isValidBusinessId(id: unknown): id is string {
  return typeof id === "string" && ID_RE.test(id);
}

const num = (v: unknown, min = 0, max = 1e12): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
};
const str = (v: unknown, max: number): string | undefined => (typeof v === "string" ? v.slice(0, max) : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined =>
  typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;

const CHANNELS = ["yandex_direct", "vk_ads", "maps_reviews", "referral", "social_organic", "offline", "other"] as const;
const SPEEDS = ["under_1h", "same_day", "slower"] as const;
const REASONS = ["price", "no_answer", "competitor", "changed_mind", "unknown"] as const;

export function sanitizeFunnel(input: unknown) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const raw of input.slice(-MAX_SNAPSHOTS)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const id = str(r.id, 64);
    if (!id) continue;
    out.push({
      id,
      createdAt: str(r.createdAt, 40) ?? new Date().toISOString(),
      label: str(r.label, 80) ?? "",
      visitors: Math.round(num(r.visitors) ?? 0),
      leads: Math.round(num(r.leads) ?? 0),
      sales: Math.round(num(r.sales) ?? 0),
      repeat: Math.round(num(r.repeat) ?? 0),
      avgReceipt: num(r.avgReceipt),
      adSpend: num(r.adSpend),
      channel: oneOf(r.channel, CHANNELS),
      responseSpeed: oneOf(r.responseSpeed, SPEEDS),
      dropReason: oneOf(r.dropReason, REASONS),
      reviewsCount: num(r.reviewsCount) === undefined ? undefined : Math.round(num(r.reviewsCount) as number),
      reviewsRating: num(r.reviewsRating, 0, 5),
    });
  }
  return out;
}

export function sanitizeChecklist(input: unknown): Record<string, boolean[]> {
  const out: Record<string, boolean[]> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>).slice(0, 60)) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(k) || !Array.isArray(v)) continue;
    out[k] = v.slice(0, 40).map(Boolean);
  }
  return out;
}

export function sanitizeProgress(input: unknown) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const raw of input.slice(-MAX_PROGRESS)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const date = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null;
    if (!date) continue;
    out.push({
      date,
      total: Math.round(num(r.total, 0, 100) ?? 0),
      foundation: Math.round(num(r.foundation, 0, 100) ?? 0),
      traffic: Math.round(num(r.traffic, 0, 100) ?? 0),
      retention: Math.round(num(r.retention, 0, 100) ?? 0),
      done: Math.round(num(r.done, 0, 100000) ?? 0),
      steps: Math.round(num(r.steps, 0, 100000) ?? 0),
    });
  }
  return out;
}

export function sanitizeTarget(input: unknown): { leadsPerMonth?: number; salesPerMonth?: number } {
  if (!input || typeof input !== "object") return {};
  const r = input as Record<string, unknown>;
  const l = num(r.leadsPerMonth, 0, 1e7);
  const s = num(r.salesPerMonth, 0, 1e7);
  return { ...(l ? { leadsPerMonth: l } : {}), ...(s ? { salesPerMonth: s } : {}) };
}

export function sanitizePlan(input: unknown): GeneratedPlan | null {
  if (!input || typeof input !== "object") return null;
  const p = input as GeneratedPlan;
  if (!Array.isArray(p.foundation) || !Array.isArray(p.traffic) || !Array.isArray(p.retention)) return null;
  try {
    if (!isPlanSizeReasonable(p)) return null;
    if (JSON.stringify(p).length > 300_000) return null;
  } catch {
    return null;
  }
  return p;
}

export interface BusinessPatch {
  name?: string;
  businessType?: string;
  vectorId?: string | null;
  checklist?: Record<string, boolean[]>;
  funnel?: ReturnType<typeof sanitizeFunnel>;
  progress?: ReturnType<typeof sanitizeProgress>;
  target?: ReturnType<typeof sanitizeTarget>;
}

/** Из тела запроса берём только присланные поля — отсутствующее не затираем. */
export function sanitizePatch(body: unknown): BusinessPatch {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const out: BusinessPatch = {};
  if ("name" in b) out.name = (str(b.name, 200) ?? "").trim() || "Мой бизнес";
  if ("businessType" in b) out.businessType = str(b.businessType, 100) ?? "";
  if ("vectorId" in b) out.vectorId = b.vectorId === null ? null : str(b.vectorId, 40) ?? null;
  if ("checklist" in b) out.checklist = sanitizeChecklist(b.checklist);
  if ("funnel" in b) out.funnel = sanitizeFunnel(b.funnel);
  if ("progress" in b) out.progress = sanitizeProgress(b.progress);
  if ("target" in b) out.target = sanitizeTarget(b.target);
  return out;
}
