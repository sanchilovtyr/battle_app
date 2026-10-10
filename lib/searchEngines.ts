// Клиенты Яндекс Вебмастера и Google Search Console (только чтение).
// Сетевые вызовы принимают fetch-функцию, чтобы их можно было проверить без сети.

import { createSign } from "crypto";

type FetchFn = typeof fetch;
const TIMEOUT_MS = 15000;

export class SearchEngineError extends Error {}

async function getJson(fetchFn: FetchFn, url: string, init: RequestInit, what: string): Promise<any> {
  let res: Response;
  try {
    res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new SearchEngineError(`${what}: сервис не отвечает. Попробуйте позже.`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new SearchEngineError(`${what}: доступ отклонён (${res.status}). Проверьте ключ и права доступа.`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new SearchEngineError(`${what}: ошибка ${res.status}. ${text.slice(0, 200)}`.trim());
  }
  return res.json().catch(() => ({}));
}

// ───────────────────────── Яндекс Вебмастер ─────────────────────────

const YW = "https://api.webmaster.yandex.net/v4";

export interface YandexQuery {
  query: string;
  shows: number;
  clicks: number;
  position: number | null;
}
export interface YandexProblem {
  code: string;
  severity: string;
  state: string;
}
export interface YandexReport {
  host: string;
  hostUrl: string;
  verified: boolean;
  sqi: number | null;
  searchablePages: number | null;
  excludedPages: number | null;
  problemCounts: Record<string, number>;
  queries: YandexQuery[];
  dateFrom: string | null;
  dateTo: string | null;
  problems: YandexProblem[];
}

export interface YandexHostInfo {
  host_id: string;
  ascii_host_url?: string;
  unicode_host_url?: string;
  verified?: boolean;
}

/** Находит в списке сайтов тот, что соответствует нужному адресу (или явно заданному host_id). */
export function pickYandexHost(hosts: YandexHostInfo[], siteUrl: string, explicit?: string): YandexHostInfo | null {
  if (explicit) return hosts.find((h) => h.host_id === explicit) ?? { host_id: explicit };
  let target = "";
  try {
    target = new URL(siteUrl).hostname.replace(/^www\./, "");
  } catch {
    // пусто
  }
  const norm = (u?: string) => {
    try {
      return new URL(u ?? "").hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  };
  const matches = hosts.filter((h) => norm(h.ascii_host_url) === target || norm(h.unicode_host_url) === target);
  // https и подтверждённый — в приоритете
  return (
    matches.find((h) => h.host_id.startsWith("https:") && h.verified) ??
    matches.find((h) => h.verified) ??
    matches[0] ??
    null
  );
}

export function parseYandexQueries(data: any): YandexQuery[] {
  const list: any[] = Array.isArray(data?.queries) ? data.queries : [];
  return list.map((q) => {
    const ind = q?.indicators ?? {};
    const pos = Number(ind.AVG_SHOW_POSITION);
    return {
      query: String(q?.query_text ?? ""),
      shows: Number(ind.TOTAL_SHOWS) || 0,
      clicks: Number(ind.TOTAL_CLICKS) || 0,
      position: Number.isFinite(pos) && ind.AVG_SHOW_POSITION != null ? Math.round(pos * 10) / 10 : null,
    };
  });
}

export function parseYandexProblems(data: any): YandexProblem[] {
  const obj = data?.problems && typeof data.problems === "object" ? data.problems : {};
  const rank: Record<string, number> = { FATAL: 0, CRITICAL: 1, POSSIBLE_PROBLEM: 2, RECOMMENDATION: 3 };
  return Object.entries(obj)
    .map(([code, v]: [string, any]) => ({ code, severity: String(v?.severity ?? ""), state: String(v?.state ?? "") }))
    .filter((p) => p.state === "PRESENT" || p.state === "")
    .sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));
}

export async function fetchYandexReport(
  token: string,
  siteUrl: string,
  explicitHost?: string,
  fetchFn: FetchFn = fetch
): Promise<YandexReport> {
  const headers = { Authorization: `OAuth ${token}` };
  const what = "Яндекс Вебмастер";
  const user = await getJson(fetchFn, `${YW}/user`, { headers }, what);
  const uid = user?.user_id;
  if (!uid) throw new SearchEngineError(`${what}: не удалось определить пользователя по токену.`);

  const hostsData = await getJson(fetchFn, `${YW}/user/${uid}/hosts`, { headers }, what);
  const hosts: YandexHostInfo[] = Array.isArray(hostsData?.hosts) ? hostsData.hosts : [];
  const host = pickYandexHost(hosts, siteUrl, explicitHost);
  if (!host) {
    throw new SearchEngineError(
      `${what}: сайт ${siteUrl} не найден среди ваших сайтов. Добавьте и подтвердите его в Вебмастере или укажите host_id вручную.`
    );
  }
  const base = `${YW}/user/${uid}/hosts/${host.host_id}`;
  const qs = "order_by=TOTAL_SHOWS&query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS&query_indicator=AVG_SHOW_POSITION";
  const [summary, popular, diag] = await Promise.all([
    getJson(fetchFn, `${base}/summary`, { headers }, what),
    getJson(fetchFn, `${base}/search-queries/popular?${qs}`, { headers }, what).catch(() => ({})),
    getJson(fetchFn, `${base}/diagnostics`, { headers }, what).catch(() => ({})),
  ]);
  const n = (v: unknown) => (typeof v === "number" ? v : v == null ? null : Number(v));
  return {
    host: host.host_id,
    hostUrl: host.ascii_host_url ?? host.host_id,
    verified: Boolean(host.verified ?? true),
    sqi: n(summary?.sqi),
    searchablePages: n(summary?.searchable_pages_count),
    excludedPages: n(summary?.excluded_pages_count),
    problemCounts: summary?.problems && typeof summary.problems === "object" ? summary.problems : {},
    queries: parseYandexQueries(popular).slice(0, 25),
    dateFrom: popular?.date_from ?? null,
    dateTo: popular?.date_to ?? null,
    problems: parseYandexProblems(diag),
  };
}

// ───────────────────────── Google Search Console ─────────────────────────

export interface GoogleKey {
  clientEmail: string;
  privateKey: string;
}

/** Принимает либо весь JSON-файл ключа сервисного аккаунта, либо пару значений. */
export function parseGoogleKeyJson(text: string): GoogleKey | null {
  try {
    const j = JSON.parse(text);
    if (j?.client_email && j?.private_key) {
      return { clientEmail: String(j.client_email), privateKey: normalizePem(String(j.private_key)) };
    }
  } catch {
    // не JSON
  }
  return null;
}

export function normalizePem(pem: string): string {
  return pem.replace(/\\n/g, "\n").trim();
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function buildGoogleJwt(key: GoogleKey, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: key.clientEmail,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );
  const data = `${header}.${claims}`;
  const sig = createSign("RSA-SHA256").update(data).sign(key.privateKey);
  return `${data}.${b64url(sig)}`;
}

export interface GoogleRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}
export interface GoogleReport {
  siteUrl: string;
  startDate: string;
  endDate: string;
  queries: GoogleRow[];
  pages: GoogleRow[];
  sitemaps: { path: string; lastDownloaded: string | null; errors: number; warnings: number }[];
}

export function parseGoogleRows(data: any): GoogleRow[] {
  const rows: any[] = Array.isArray(data?.rows) ? data.rows : [];
  return rows.map((r) => ({
    key: String(r?.keys?.[0] ?? ""),
    clicks: Number(r?.clicks) || 0,
    impressions: Number(r?.impressions) || 0,
    ctr: Math.round((Number(r?.ctr) || 0) * 1000) / 10, // в процентах
    position: Math.round((Number(r?.position) || 0) * 10) / 10,
  }));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function fetchGoogleReport(
  key: GoogleKey,
  siteUrl: string,
  fetchFn: FetchFn = fetch,
  now = new Date()
): Promise<GoogleReport> {
  const what = "Google Search Console";
  const form = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: buildGoogleJwt(key),
  });
  const tok = await getJson(
    fetchFn,
    "https://oauth2.googleapis.com/token",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() },
    what
  );
  if (!tok?.access_token) throw new SearchEngineError(`${what}: не удалось получить токен по ключу сервисного аккаунта.`);
  const headers = { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" };

  // Данные Search Console приходят с задержкой в 2–3 дня
  const end = new Date(now.getTime() - 3 * 86400000);
  const start = new Date(end.getTime() - 27 * 86400000);
  const base = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}`;
  const q = (dim: string) =>
    getJson(
      fetchFn,
      `${base}/searchAnalytics/query`,
      { method: "POST", headers, body: JSON.stringify({ startDate: iso(start), endDate: iso(end), dimensions: [dim], rowLimit: 25 }) },
      what
    );
  const [queries, pages] = await Promise.all([q("query"), q("page")]);
  const sm = await getJson(fetchFn, `${base}/sitemaps`, { headers }, what).catch(() => ({}));
  const sitemaps = (Array.isArray(sm?.sitemap) ? sm.sitemap : []).map((s: any) => ({
    path: String(s?.path ?? ""),
    lastDownloaded: s?.lastDownloaded ?? null,
    errors: Number(s?.errors) || 0,
    warnings: Number(s?.warnings) || 0,
  }));
  return {
    siteUrl,
    startDate: iso(start),
    endDate: iso(end),
    queries: parseGoogleRows(queries),
    pages: parseGoogleRows(pages),
    sitemaps,
  };
}
