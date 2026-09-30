import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./db";
import { decryptSecret } from "./secretBox";

// Интеграция с Яндекс Метрикой пользователя (не нашей собственной). Каждый
// клиент подключает свой аккаунт Яндекса через OAuth и разрешает нам читать
// статистику своего счётчика (право metrika:read) — токен принадлежит его
// аккаунту, а не владельцу сервиса. Подробнее: README, раздел про Метрику.

const OAUTH_AUTHORIZE_URL = "https://oauth.yandex.ru/authorize";
const OAUTH_TOKEN_URL = "https://oauth.yandex.ru/token";
const MANAGEMENT_API = "https://api-metrika.yandex.net/management/v1";
const REPORT_API = "https://api-metrika.yandex.net/stat/v1/data";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 минут на прохождение OAuth-флоу

function getSigningSecret(): string {
  return process.env.NEXTAUTH_SECRET || "";
}

export interface OAuthState {
  userId: string;
  businessId: string;
}

/** Подписываем userId+businessId, чтобы Яндекс вернул их назад в redirect
 *  нетронутыми и незаметно для пользователя не подменёнными на чужие. */
export function signState(payload: OAuthState): string {
  const raw = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + STATE_TTL_MS })).toString(
    "base64url"
  );
  const signature = createHmac("sha256", getSigningSecret()).update(raw).digest("hex");
  return `${raw}.${signature}`;
}

export function verifyState(token: string | null): OAuthState | null {
  if (!token) return null;
  const [raw, signature] = token.split(".");
  if (!raw || !signature) return null;

  const expected = createHmac("sha256", getSigningSecret()).update(raw).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) return null;
    if (typeof parsed.userId !== "string" || typeof parsed.businessId !== "string") return null;
    return { userId: parsed.userId, businessId: parsed.businessId };
  } catch {
    return null;
  }
}

function getRedirectUri(): string {
  const siteUrl = process.env.NEXTAUTH_URL || "";
  return `${siteUrl}/api/metrika/callback`;
}

export function buildAuthorizeUrl(state: string): string {
  const clientId = process.env.YANDEX_METRIKA_CLIENT_ID || "";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    state,
  });
  return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string | null;
}

export async function exchangeCodeForToken(code: string): Promise<TokenResult> {
  const clientId = process.env.YANDEX_METRIKA_CLIENT_ID || "";
  const clientSecret = process.env.YANDEX_METRIKA_CLIENT_SECRET || "";

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Не удалось обменять код на токен Яндекс Метрики: ${res.status} ${text}`);
  }

  const data = await res.json();
  return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null };
}

export interface MetrikaCounter {
  id: string;
  name: string;
  site: string;
}

export async function fetchCounters(accessToken: string): Promise<MetrikaCounter[]> {
  const res = await fetch(`${MANAGEMENT_API}/counters?per_page=100`, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Не удалось получить список счётчиков Метрики: ${res.status}`);
  }
  const data = await res.json();
  const counters = Array.isArray(data?.counters) ? data.counters : [];
  return counters.map((c: { id: number | string; name: string; site: string }) => ({
    id: String(c.id),
    name: c.name,
    site: c.site,
  }));
}

export interface MetrikaGoal {
  id: string;
  name: string;
}

export async function fetchGoals(accessToken: string, counterId: string): Promise<MetrikaGoal[]> {
  const res = await fetch(`${MANAGEMENT_API}/counter/${counterId}/goals`, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Не удалось получить список целей счётчика: ${res.status}`);
  }
  const data = await res.json();
  const goals = Array.isArray(data?.goals) ? data.goals : [];
  return goals.map((g: { id: number | string; name: string }) => ({ id: String(g.id), name: g.name }));
}

export interface MetrikaStats {
  visitors: number;
  leads: number | null;
  sales: number | null;
}

/**
 * Тянет агрегированные показатели за период из Reporting API. Всегда
 * запрашивает визиты; заявки/продажи — только если для счётчика сопоставлены
 * конкретные цели (иначе взять их просто не из чего).
 */
export async function fetchStats(
  accessToken: string,
  counterId: string,
  params: { date1: string; date2: string; leadsGoalId?: string | null; salesGoalId?: string | null }
): Promise<MetrikaStats> {
  const metrics = ["ym:s:visits"];
  if (params.leadsGoalId) metrics.push(`ym:s:goal${params.leadsGoalId}reaches`);
  if (params.salesGoalId) metrics.push(`ym:s:goal${params.salesGoalId}reaches`);

  const query = new URLSearchParams({
    ids: counterId,
    metrics: metrics.join(","),
    date1: params.date1,
    date2: params.date2,
  });

  const res = await fetch(`${REPORT_API}?${query.toString()}`, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Не удалось получить статистику из Метрики: ${res.status}`);
  }

  const data = await res.json();
  const totals: number[] = Array.isArray(data?.totals?.[0]) ? data.totals[0] : data?.totals ?? [];

  let i = 0;
  const visitors = Math.round(totals[i++] ?? 0);
  const leads = params.leadsGoalId ? Math.round(totals[i++] ?? 0) : null;
  const sales = params.salesGoalId ? Math.round(totals[i++] ?? 0) : null;

  return { visitors, leads, sales };
}

/** Находит подключение и сразу расшифровывает токен доступа — общая часть
 *  для всех ручек, которым нужно сходить в API Метрики от имени пользователя. */
export async function getDecryptedConnection(userId: string, businessId: string) {
  const record = await prisma.metrikaConnection.findUnique({
    where: { userId_businessId: { userId, businessId } },
  });
  if (!record) return null;
  return { ...record, accessToken: decryptSecret(record.accessToken) };
}

/** Первое число текущего месяца и сегодня, в формате YYYY-MM-DD (то, что ждёт Reporting API). */
export function currentMonthRange(): { date1: string; date2: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { date1: fmt(first), date2: fmt(now) };
}
