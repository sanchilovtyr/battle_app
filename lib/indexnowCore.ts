import { createHash } from "crypto";
import { SITE_URL } from "@/lib/blog";

/**
 * IndexNow — протокол, которым сайт сам сообщает Яндексу и Bing о новых и изменённых страницах,
 * не дожидаясь обхода роботом. Гарантии индексации он не даёт, но новые статьи обычно замечаются быстрее.
 * Google IndexNow не поддерживает. Этот файл — чистые функции без базы и сети (их проверяют тесты).
 */

export const INDEXNOW_ENDPOINTS = {
  yandex: "https://yandex.com/indexnow",
  bing: "https://www.bing.com/indexnow",
} as const;

const KEY_RE = /^[A-Za-z0-9-]{8,128}$/;
export const isValidKey = (k: string) => KEY_RE.test(k);

/**
 * Ключ владельца сайта. Берём INDEXNOW_KEY, если он задан, иначе выводим постоянный ключ из
 * NEXTAUTH_SECRET (хеш, обратно секрет не восстановить) — настраивать ничего не нужно.
 * Сам ключ по протоколу публичный: он лежит в файле /<ключ>.txt в корне сайта.
 */
export function getIndexNowKey(env: Record<string, string | undefined> = process.env): string | null {
  const custom = (env.INDEXNOW_KEY || "").trim();
  if (custom) return isValidKey(custom) ? custom : null;
  const secret = env.NEXTAUTH_SECRET;
  if (!secret) return null;
  return createHash("sha256").update(`indexnow:${secret}`).digest("hex").slice(0, 32);
}

export const keyFileUrl = (key: string) => `${SITE_URL}/${key}.txt`;

/** Приводит пути и адреса к полным URL сайта, убирает чужие домены и повторы */
export function normalizeUrls(items: string[], limit = 10000): string[] {
  const host = new URL(SITE_URL).host;
  const out = new Set<string>();
  for (const raw of items) {
    // принимаем только пути сайта (/blog/...) и полные http(s)-адреса
    if (!/^(\/(?!\/)|https?:\/\/)/i.test(raw)) continue;
    try {
      const u = new URL(raw, SITE_URL);
      if (u.host !== host || !/^https?:$/.test(u.protocol)) continue;
      u.hash = "";
      out.add(u.toString());
    } catch {
      // некорректный адрес пропускаем
    }
  }
  return Array.from(out).slice(0, limit);
}

export function buildPayload(key: string, urls: string[]) {
  return { host: new URL(SITE_URL).host, key, keyLocation: keyFileUrl(key), urlList: urls };
}

/** 200 — принято, 202 — принято, ключ проверится позже */
export const isAccepted = (status: number) => status === 200 || status === 202;

export interface PendingPost {
  id: string;
  slug: string;
  published: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  indexNowAt: Date | null;
}

/**
 * Какие статьи ещё не отправлены: опубликованы (дата уже наступила) и либо ни разу не отправлялись,
 * либо менялись после отправки. Допуск в 2 секунды — сама отметка об отправке тоже обновляет updatedAt.
 */
export function pendingPosts(posts: PendingPost[], now: Date): PendingPost[] {
  return posts.filter(
    (p) =>
      p.published &&
      p.publishedAt !== null &&
      p.publishedAt <= now &&
      (p.indexNowAt == null || p.updatedAt.getTime() - p.indexNowAt.getTime() > 2000)
  );
}

export interface SubmitResult {
  yandex: number;
  bing: number;
  error: string;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ status: number }>;

/** Отправляет список адресов в Яндекс и Bing. Ошибка сети даёт статус 0, а не исключение */
export async function submitToIndexNow(
  key: string,
  urls: string[],
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = 4000
): Promise<SubmitResult> {
  const body = JSON.stringify(buildPayload(key, urls));
  const send = async (endpoint: string): Promise<{ status: number; error: string }> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body,
        signal: ctrl.signal,
      });
      return { status: res.status, error: "" };
    } catch (e) {
      return { status: 0, error: e instanceof Error ? e.message : "ошибка сети" };
    } finally {
      clearTimeout(timer);
    }
  };
  const [y, b] = await Promise.all([send(INDEXNOW_ENDPOINTS.yandex), send(INDEXNOW_ENDPOINTS.bing)]);
  const error = [y.error && `Яндекс: ${y.error}`, b.error && `Bing: ${b.error}`].filter(Boolean).join("; ");
  return { yandex: y.status, bing: b.status, error };
}
