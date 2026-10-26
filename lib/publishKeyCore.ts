// Ключ публикации статей (для Claude и других внешних помощников). Чистая логика без базы — покрыта тестами.
import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const PUBLISH_KEY_PREFIX = "kslv_";
export const MIN_LEAD_MS = 60 * 60 * 1000; // не раньше чем через час — чтобы успеть посмотреть статью в админке
export const MAX_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;
export const MAX_QUEUE = 30; // сколько статей одновременно может ждать публикации

export function generatePublishKey(): string {
  return PUBLISH_KEY_PREFIX + randomBytes(24).toString("hex");
}

export function hashPublishKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function keyMatches(presented: string, storedHash: string): boolean {
  if (!presented || !storedHash) return false;
  const a = Buffer.from(hashPublishKey(presented.trim()), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bearerFrom(header: string | null): string {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? "");
  return m ? m[1] : "";
}

/** Проверка режима и даты: внешний ключ не может опубликовать статью сразу, только отложить или оставить черновиком. */
export function checkPublishMode(raw: unknown, now = Date.now()): { ok: true } | { ok: false; error: string } {
  const b = (raw ?? {}) as Record<string, unknown>;
  const mode = String(b.publishMode ?? "draft");
  if (mode === "draft") return { ok: true };
  if (mode !== "schedule") return { ok: false, error: 'publishMode: допустимо только "schedule" или "draft" (мгновенная публикация по ключу запрещена)' };
  const t = new Date(String(b.publishAt ?? "")).getTime();
  if (Number.isNaN(t)) return { ok: false, error: "publishAt: укажите дату и время в формате ISO, например 2026-10-20T09:00:00+03:00" };
  if (t < now + MIN_LEAD_MS) return { ok: false, error: "publishAt: дата должна быть не раньше чем через час — это время на проверку статьи" };
  if (t > now + MAX_AHEAD_MS) return { ok: false, error: "publishAt: не дальше чем на 90 дней вперёд" };
  return { ok: true };
}

/** Ограничитель неудачных попыток по адресу (в памяти процесса — этого достаточно для защиты от перебора). */
export function makeFailLimiter(max = 10, windowMs = 10 * 60 * 1000) {
  const hits = new Map<string, number[]>();
  return {
    blocked(id: string, now = Date.now()) {
      const list = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
      hits.set(id, list);
      return list.length >= max;
    },
    fail(id: string, now = Date.now()) {
      const list = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
      list.push(now);
      hits.set(id, list);
    },
  };
}
