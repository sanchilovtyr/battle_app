/**
 * Собственная аналитика посещений: чистые функции (без базы и сети), поэтому покрыты тестами.
 * Источник визита определяется по UTM-меткам, рекламным кликам (yclid/gclid) и адресу, с которого пришёл человек.
 */

export type Channel = "paid" | "search" | "social" | "ai" | "email" | "referral" | "tagged" | "direct";

export const CHANNEL_LABELS: Record<Channel, string> = {
  paid: "Платная реклама",
  search: "Поиск",
  social: "Соцсети и мессенджеры",
  ai: "ИИ-ассистенты",
  email: "Рассылки",
  referral: "Переходы с других сайтов",
  tagged: "Ссылки с метками",
  direct: "Прямые заходы",
};

export interface TouchInput {
  referrer?: string | null;
  /** Хосты самого сайта: переход «с себя» источником не считается */
  ownHosts?: string[];
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  yclid?: string | null;
  gclid?: string | null;
}

export interface Touch {
  channel: Channel;
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
  referrerHost: string;
}

const SEARCH: [RegExp, string][] = [
  [/(^|\.)yandex\.[a-z.]+$|^ya\.ru$/, "Яндекс"],
  [/(^|\.)google\.[a-z.]+$/, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/(^|\.)go\.mail\.ru$|(^|\.)search\.mail\.ru$/, "Mail.ru"],
  [/(^|\.)rambler\.ru$/, "Рамблер"],
  [/(^|\.)sputnik\.ru$/, "Спутник"],
  [/(^|\.)ecosia\.org$/, "Ecosia"],
];
const SOCIAL: [RegExp, string][] = [
  [/(^|\.)vk\.com$|(^|\.)vk\.ru$|(^|\.)m\.vk\.com$/, "ВКонтакте"],
  [/(^|\.)t\.me$|(^|\.)telegram\.org$|(^|\.)web\.telegram\.org$/, "Telegram"],
  [/(^|\.)ok\.ru$/, "Одноклассники"],
  [/(^|\.)dzen\.ru$/, "Дзен"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "YouTube"],
  [/(^|\.)habr\.com$/, "Хабр"],
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)whatsapp\.com$|(^|\.)wa\.me$/, "WhatsApp"],
  [/(^|\.)pikabu\.ru$/, "Пикабу"],
  [/(^|\.)vc\.ru$/, "vc.ru"],
];
const AI: [RegExp, string][] = [
  [/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/, "ChatGPT"],
  [/(^|\.)perplexity\.ai$/, "Perplexity"],
  [/(^|\.)claude\.ai$/, "Claude"],
  [/(^|\.)gemini\.google\.com$/, "Gemini"],
  [/(^|\.)copilot\.microsoft\.com$/, "Copilot"],
  [/(^|\.)alice\.yandex\.ru$|(^|\.)neuro\.yandex\.ru$/, "Алиса / Нейропоиск"],
  [/(^|\.)giga\.chat$|(^|\.)gigachat\.ru$/, "GigaChat"],
];
/** Переходы, которые не считаются источником: оплата и вход через Яндекс — человек уже был на сайте */
const IGNORED_REFERRERS = /(^|\.)yookassa\.ru$|(^|\.)yoomoney\.ru$|^passport\.yandex\.(ru|com)$|^oauth\.yandex\.(ru|com)$/;

const PAID_MEDIUMS = /^(cpc|ppc|cpm|cpv|paid|paidsearch|paid_social|banner|display|retargeting|remarketing|context|ads|adv|yandex_direct|direct)$/i;
const EMAIL_MEDIUMS = /^(email|e-mail|mail|newsletter|rassylka|push)$/i;
const SOCIAL_MEDIUMS = /^(social|smm|social-network|messenger|sm)$/i;

function clean(v: unknown, max = 80): string {
  if (typeof v !== "string") return "";
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

export function hostFromUrl(url: string | null | undefined): string {
  if (!url || typeof url !== "string") return "";
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function matchName(list: [RegExp, string][], host: string): string | null {
  for (const [re, name] of list) if (re.test(host)) return name;
  return null;
}

export function classifyTouch(input: TouchInput): Touch {
  const own = (input.ownHosts ?? []).map((h) => h.toLowerCase().replace(/^www\./, ""));
  const refHost = hostFromUrl(input.referrer);
  const external = refHost && !own.includes(refHost) && !IGNORED_REFERRERS.test(refHost) ? refHost : "";

  const utmSource = clean(input.utm_source, 60).toLowerCase();
  const utmMedium = clean(input.utm_medium, 40).toLowerCase();
  const campaign = clean(input.utm_campaign, 100);
  const term = clean(input.utm_term, 100);
  const content = clean(input.utm_content, 100);
  const hasUtm = !!(utmSource || utmMedium || campaign);

  const base = { medium: utmMedium, campaign, term, content, referrerHost: external };

  // Рекламные клики Яндекса и Google без меток: источник известен по самому идентификатору
  if (!utmSource && !utmMedium && (input.yclid || input.gclid)) {
    return { ...base, channel: "paid", source: input.yclid ? "Яндекс Директ" : "Google Ads", medium: "cpc" };
  }

  if (hasUtm) {
    let channel: Channel = "tagged";
    if (PAID_MEDIUMS.test(utmMedium) || input.yclid || input.gclid) channel = "paid";
    else if (EMAIL_MEDIUMS.test(utmMedium)) channel = "email";
    else if (SOCIAL_MEDIUMS.test(utmMedium) || (!utmMedium && matchName(SOCIAL, utmSource + ".com"))) channel = "social";
    else if (/^(organic|seo)$/i.test(utmMedium)) channel = "search";
    else if (/^(referral|link|partner|affiliate)$/i.test(utmMedium)) channel = "referral";
    const source = utmSource || external || "(не указан)";
    return { ...base, channel, source };
  }

  if (external) {
    const ai = matchName(AI, external);
    if (ai) return { ...base, channel: "ai", source: ai };
    const se = matchName(SEARCH, external);
    if (se) return { ...base, channel: "search", source: se };
    const so = matchName(SOCIAL, external);
    if (so) return { ...base, channel: "social", source: so };
    return { ...base, channel: "referral", source: external };
  }

  return { ...base, channel: "direct", source: "(прямой заход)" };
}

/** Роботов и скриптов в статистику посетителей не берём */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return /bot\b|bot\/|crawl|spider|slurp|headless|lighthouse|pagespeed|curl\/|wget|python-requests|axios|go-http|okhttp|facebookexternalhit|uptime|monitor|yandex(metrika|accessibility|images|direct|webmaster|search|turbo|market|video|blogs|news|pagechecker|sitelinks|antivirus|fetcher)/i.test(ua);
}

const ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
export function validId(v: unknown): v is string {
  return typeof v === "string" && ID_RE.test(v);
}

/** Путь страницы без параметров; служебные разделы не учитываем */
export function normalizePath(p: unknown): string | null {
  if (typeof p !== "string") return null;
  const path = p.split("?")[0].split("#")[0].slice(0, 200);
  if (!path.startsWith("/")) return null;
  if (/^\/(admin|api|_next)(\/|$)/.test(path)) return null;
  return path;
}

// ───────────── поведение: вебвизор и карты ─────────────

/** Публичные страницы: только на них пишутся сессии и собираются клики и прокрутка. Кабинет и оплата — никогда. */
const BEHAVIOR_PREFIXES = ["/blog", "/about", "/prodvizhenie", "/oferta", "/privacy"];
export function isBehaviorPath(path: string | null | undefined): boolean {
  if (!path) return false;
  if (path === "/") return true;
  return BEHAVIOR_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

export type Device = "desktop" | "tablet" | "mobile";
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 820, mobile: 390 };
export function deviceFromWidth(w: number): Device {
  if (!Number.isFinite(w) || w <= 0) return "desktop";
  return w < 768 ? "mobile" : w < 1100 ? "tablet" : "desktop";
}
export function validDevice(v: unknown): v is Device {
  return v === "desktop" || v === "tablet" || v === "mobile";
}

export const CLICK_GRID = 20;
/** Селектор, который строит счётчик: теги, :nth-of-type, #id и «>» */
const SELECTOR_RE = /^[\w#:()>\\ \-]{1,300}$/;
export function validSelector(v: unknown): v is string {
  return typeof v === "string" && SELECTOR_RE.test(v);
}

export interface ClickIn { s: string; x: number; y: number }
export function sanitizeClicks(raw: unknown, max = 30): ClickIn[] {
  if (!Array.isArray(raw)) return [];
  const out: ClickIn[] = [];
  for (const c of raw.slice(0, max)) {
    if (!c || !validSelector(c.s)) continue;
    const x = Math.floor(Number(c.x));
    const y = Math.floor(Number(c.y));
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;
    out.push({ s: c.s, x: Math.min(CLICK_GRID - 1, Math.max(0, x)), y: Math.min(CLICK_GRID - 1, Math.max(0, y)) });
  }
  return out;
}

export interface ScrollBucketsInput { buckets: number[] }
/** Доля просмотров, дошедших до каждой десятой части страницы (индекс 0 — верх, 9 — низ) */
export function scrollReach(hist: number[]): { views: number; reach: number[] } {
  const h = Array.from({ length: 11 }, (_, i) => Math.max(0, Math.floor(hist[i] || 0)));
  const views = h.reduce((a, b) => a + b, 0);
  const reach: number[] = [];
  for (let k = 0; k < 10; k++) {
    let ge = 0;
    for (let b = k; b <= 10; b++) ge += h[b];
    reach.push(views ? Math.round((ge / views) * 1000) / 10 : 0);
  }
  return { views, reach };
}

// ───────────── отчёт ─────────────

/** Отказ: один просмотр и меньше BOUNCE_SEC секунд активного времени (как в Яндекс Метрике) */
export const BOUNCE_SEC = 15;
export const MAX_ACTIVE_SEC = 7200;
/** Меньше стольких визитов — процент отказов ненадёжен */
export const BOUNCE_MIN_SESSIONS = 10;

export interface SessionRow {
  id: string;
  visitorId: string;
  startedAt: Date;
  pageViews: number;
  /** Активное время, сек; -1 или нет — не измерялось */
  activeSec?: number;
  channel: string;
  source: string;
  medium: string;
  campaign: string;
  landingPath: string;
}
export interface VisitorRow {
  id: string;
  firstSeenAt: Date;
  userId: string | null;
  channel: string;
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
  referrerHost: string;
  landingPath: string;
}
export interface PaymentRow {
  userId: string;
  email: string;
  planId: string;
  amountKopecks: number;
  createdAt: Date;
}
export interface UserRow {
  id: string;
  createdAt: Date;
}

export interface ReportInput {
  /** Начало периода (полночь по Москве) и конец (не включая) */
  from: Date;
  to: Date;
  /** Сессии за период */
  sessions: SessionRow[];
  /** Посетители, впервые пришедшие за период */
  newVisitors: VisitorRow[];
  /** Посетители, привязанные к пользователям (для источника оплаты) */
  linkedVisitors: VisitorRow[];
  /** Все сессии привязанных посетителей (для последнего касания) */
  linkedSessions: SessionRow[];
  /** Первые успешные платежи каждого пользователя за период */
  firstPayments: PaymentRow[];
  /** Все пользователи, зарегистрированные за период */
  users: UserRow[];
  /** Пользователи, у которых есть хотя бы один успешный платёж за всё время */
  paidEverUsers?: Set<string>;
  /** Пользователи, привязанные к какому-либо посетителю */
  linkedUserIds?: Set<string>;
}

const MSK = 3 * 3600_000;
export function mskDay(d: Date): string {
  return new Date(d.getTime() + MSK).toISOString().slice(0, 10);
}
export function periodStart(now: Date, days: number): Date {
  // Начало суток по Москве, days суток включая сегодняшние
  const dayStartMsk = Math.floor((now.getTime() + MSK) / 86400000) * 86400000 - MSK;
  return new Date(dayStartMsk - (days - 1) * 86400000);
}

export interface Range {
  from: Date;
  to: Date;
  days: number;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_RANGE_DAYS = 366;

/** Период из запроса: либо «последние N дней», либо произвольные даты from/to (включительно, по Москве) */
export function resolveRange(q: { days?: number | null; from?: string | null; to?: string | null }, now: Date): Range {
  const todayStart = periodStart(now, 1);
  const tomorrow = new Date(todayStart.getTime() + 86400000);
  if (q.from && DAY_RE.test(q.from)) {
    const start = new Date(Date.parse(q.from + "T00:00:00Z") - MSK);
    let endIncl = q.to && DAY_RE.test(q.to) ? new Date(Date.parse(q.to + "T00:00:00Z") - MSK) : todayStart;
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(endIncl.getTime())) {
      if (endIncl > todayStart) endIncl = todayStart;
      let from = start;
      if (from > endIncl) from = endIncl;
      let to = new Date(endIncl.getTime() + 86400000);
      if (to > tomorrow) to = tomorrow;
      let days = Math.round((to.getTime() - from.getTime()) / 86400000);
      if (days > MAX_RANGE_DAYS) {
        from = new Date(to.getTime() - MAX_RANGE_DAYS * 86400000);
        days = MAX_RANGE_DAYS;
      }
      return { from, to, days };
    }
  }
  const d = [1, 7, 30, 90, 180, 365].includes(Number(q.days)) ? Number(q.days) : 30;
  return { from: periodStart(now, d), to: tomorrow, days: d };
}

export interface SourceRow extends BounceStat {
  channel: string;
  channelLabel: string;
  source: string;
  medium: string;
  campaign: string;
  visitors: number;
  sessions: number;
  pagesPerSession: number;
}
export interface CohortRow {
  channel: string;
  channelLabel: string;
  source: string;
  campaign: string;
  newVisitors: number;
  registered: number;
  paid: number;
  /** Доля оплативших среди новых посетителей, % */
  conversionPct: number;
}
export interface ConversionRow {
  paidAt: string;
  email: string;
  planId: string;
  amountKopecks: number;
  known: boolean;
  firstTouchAt: string | null;
  daysToPay: number | null;
  first: { channel: string; channelLabel: string; source: string; medium: string; campaign: string; landingPath: string } | null;
  last: { channel: string; channelLabel: string; source: string; medium: string; campaign: string; at: string } | null;
}

export interface Report {
  days: number;
  from: string;
  /** Последний день периода включительно (по Москве) */
  toDay: string;
  totals: {
    uniqueVisitors: number;
    sessions: number;
    newVisitors: number;
    registrations: number;
    registrationsAttributed: number;
    paid: number;
    paidAttributed: number;
    conversionPct: number;
  } & BounceStat;
  daily: { day: string; visitors: number; sessions: number }[];
  channels: ({ channel: string; label: string; visitors: number; sessions: number; share: number } & BounceStat)[];
  sources: SourceRow[];
  landing: { path: string; sessions: number }[];
  cohorts: CohortRow[];
  conversions: ConversionRow[];
}

/** Время на сайте измерено (сессии до обновления счётчика не учитываются в отказах) */
export const isMeasured = (s: { activeSec?: number }) => typeof s.activeSec === "number" && s.activeSec >= 0;
export const isBounce = (s: { pageViews: number; activeSec?: number }) => isMeasured(s) && s.pageViews <= 1 && (s.activeSec as number) < BOUNCE_SEC;

export interface BounceStat {
  /** Визитов с измеренным временем */
  measured: number;
  bounced: number;
  /** % отказов среди измеренных; null — нет измеренных визитов */
  bouncePct: number | null;
  /** Среднее активное время визита, сек */
  avgSec: number | null;
}
function bounceStat(rows: SessionRow[]): BounceStat {
  let measured = 0, bounced = 0, sec = 0;
  for (const s of rows) {
    if (!isMeasured(s)) continue;
    measured++;
    sec += Math.min(MAX_ACTIVE_SEC, s.activeSec as number);
    if (isBounce(s)) bounced++;
  }
  return {
    measured,
    bounced,
    bouncePct: measured ? pct(bounced, measured) : null,
    avgSec: measured ? Math.round(sec / measured) : null,
  };
}

const label = (c: string) => CHANNEL_LABELS[c as Channel] ?? c;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

export function buildReport(input: ReportInput): Report {
  const from = input.from;
  const days = Math.max(1, Math.round((input.to.getTime() - from.getTime()) / 86400000));

  // Посетители и сессии по дням (по Москве); дни без визитов тоже выводятся
  const dayMap = new Map<string, { v: Set<string>; s: number }>();
  for (let i = 0; i < days; i++) {
    dayMap.set(mskDay(new Date(from.getTime() + i * 86400000 + 12 * 3600_000)), { v: new Set(), s: 0 });
  }
  const allVisitors = new Set<string>();
  for (const s of input.sessions) {
    allVisitors.add(s.visitorId);
    const d = dayMap.get(mskDay(s.startedAt));
    if (d) {
      d.v.add(s.visitorId);
      d.s++;
    }
  }
  const daily = Array.from(dayMap, ([day, d]) => ({ day, visitors: d.v.size, sessions: d.s }));

  // Источники: канал → источник/метка/кампания
  const key = (s: SessionRow) => [s.channel, s.source, s.medium, s.campaign].join("\u0001");
  const srcMap = new Map<string, { row: SessionRow; v: Set<string>; s: number; pages: number; list: SessionRow[] }>();
  const chMap = new Map<string, { v: Set<string>; s: number; list: SessionRow[] }>();
  const landMap = new Map<string, number>();
  for (const s of input.sessions) {
    const k = key(s);
    const e = srcMap.get(k) ?? { row: s, v: new Set<string>(), s: 0, pages: 0, list: [] };
    e.v.add(s.visitorId);
    e.s++;
    e.pages += s.pageViews;
    e.list.push(s);
    srcMap.set(k, e);
    const c = chMap.get(s.channel) ?? { v: new Set<string>(), s: 0, list: [] };
    c.v.add(s.visitorId);
    c.s++;
    c.list.push(s);
    chMap.set(s.channel, c);
    if (s.landingPath) landMap.set(s.landingPath, (landMap.get(s.landingPath) ?? 0) + 1);
  }
  const sources: SourceRow[] = Array.from(srcMap.values())
    .map((e) => ({
      channel: e.row.channel,
      channelLabel: label(e.row.channel),
      source: e.row.source,
      medium: e.row.medium,
      campaign: e.row.campaign,
      visitors: e.v.size,
      sessions: e.s,
      pagesPerSession: Math.round((e.pages / e.s) * 10) / 10,
      ...bounceStat(e.list),
    }))
    .sort((a, b) => b.sessions - a.sessions);
  const totalSessions = input.sessions.length;
  const channels = Array.from(chMap, ([channel, c]) => ({
    channel,
    label: label(channel),
    visitors: c.v.size,
    sessions: c.s,
    share: pct(c.s, totalSessions),
    ...bounceStat(c.list),
  })).sort((a, b) => b.sessions - a.sessions);
  const landing = Array.from(landMap, ([path, sessions]) => ({ path, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  // Платежи и когорты
  const paidUsers = new Set(input.firstPayments.map((p) => p.userId));
  const visitorsByUser = new Map<string, VisitorRow>();
  for (const v of input.linkedVisitors) {
    if (!v.userId) continue;
    const cur = visitorsByUser.get(v.userId);
    if (!cur || v.firstSeenAt < cur.firstSeenAt) visitorsByUser.set(v.userId, v);
  }

  // Когорта: впервые пришли за период → кто зарегистрировался и кто оплатил (по любой дате)
  const coh = new Map<string, CohortRow>();
  for (const v of input.newVisitors) {
    const k = [v.channel, v.source, v.campaign].join("\u0001");
    const e = coh.get(k) ?? {
      channel: v.channel,
      channelLabel: label(v.channel),
      source: v.source,
      campaign: v.campaign,
      newVisitors: 0,
      registered: 0,
      paid: 0,
      conversionPct: 0,
    };
    e.newVisitors++;
    if (v.userId) {
      e.registered++;
      // «Оплатил» — по всем платежам привязанного пользователя, не только за период
      if (paidEver(v.userId)) e.paid++;
    }
    coh.set(k, e);
  }
  function paidEver(userId: string): boolean {
    return paidUsers.has(userId) || input.paidEverUsers?.has(userId) === true;
  }
  const cohorts = Array.from(coh.values())
    .map((c) => ({ ...c, conversionPct: pct(c.paid, c.newVisitors) }))
    .sort((a, b) => b.newVisitors - a.newVisitors);

  // Список оплат с источником: первое и последнее касание
  const sessByVisitor = new Map<string, SessionRow[]>();
  for (const s of input.linkedSessions) {
    const arr = sessByVisitor.get(s.visitorId) ?? [];
    arr.push(s);
    sessByVisitor.set(s.visitorId, arr);
  }
  const conversions: ConversionRow[] = input.firstPayments
    .map((p) => {
      const v = visitorsByUser.get(p.userId);
      let last: ConversionRow["last"] = null;
      if (v) {
        const list = (sessByVisitor.get(v.id) ?? []).filter((s) => s.startedAt <= p.createdAt);
        list.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
        const l = list[0];
        if (l) last = { channel: l.channel, channelLabel: label(l.channel), source: l.source, medium: l.medium, campaign: l.campaign, at: l.startedAt.toISOString() };
      }
      return {
        paidAt: p.createdAt.toISOString(),
        email: p.email,
        planId: p.planId,
        amountKopecks: p.amountKopecks,
        known: !!v,
        firstTouchAt: v ? v.firstSeenAt.toISOString() : null,
        daysToPay: v ? Math.max(0, Math.floor((p.createdAt.getTime() - v.firstSeenAt.getTime()) / 86400000)) : null,
        first: v
          ? { channel: v.channel, channelLabel: label(v.channel), source: v.source, medium: v.medium, campaign: v.campaign, landingPath: v.landingPath }
          : null,
        last,
      };
    })
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));

  const regAttributed = input.users.filter((u) => input.linkedUserIds?.has(u.id)).length;
  const paidAttributed = conversions.filter((c) => c.known).length;
  const totalUnique = allVisitors.size;

  return {
    days,
    from: from.toISOString(),
    toDay: mskDay(new Date(input.to.getTime() - 3600_000)),
    totals: {
      uniqueVisitors: totalUnique,
      sessions: totalSessions,
      newVisitors: input.newVisitors.length,
      registrations: input.users.length,
      registrationsAttributed: regAttributed,
      paid: conversions.length,
      paidAttributed,
      conversionPct: pct(conversions.length, totalUnique),
      ...bounceStat(input.sessions),
    },
    daily,
    channels,
    sources,
    landing,
    cohorts,
    conversions: conversions.slice(0, 200),
  };
}
