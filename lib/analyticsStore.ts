import { createHash } from "crypto";
import { gzipSync, gunzipSync } from "zlib";
import { prisma } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import {
  ClickIn,
  CLICK_GRID,
  Device,
  buildReport,
  classifyTouch,
  Range,
  Report,
  SessionRow,
  VisitorRow,
} from "@/lib/analyticsCore";

// Модели появились после последней генерации клиента Prisma — обращаемся через any (после `prisma generate` типы подтянутся)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export const VISITOR_COOKIE = "mn_vid";

export interface HitInput {
  vid: string;
  sid: string;
  path: string;
  referrer?: string | null;
  params?: Record<string, string | null | undefined>;
  ownHosts: string[];
  /** Первый просмотр сессии: только он определяет источник */
  isNewSession: boolean;
  userId?: string | null;
  device?: Device;
  /** Решение о записи сессии для вебвизора (принимает сервер при начале сессии) */
  record?: boolean;
}

export async function recordHit(h: HitInput): Promise<{ recorded: boolean }> {
  const now = new Date();
  const p = h.params ?? {};
  const touch = classifyTouch({
    referrer: h.isNewSession ? h.referrer : null,
    ownHosts: h.ownHosts,
    utm_source: p.utm_source,
    utm_medium: p.utm_medium,
    utm_campaign: p.utm_campaign,
    utm_term: p.utm_term,
    utm_content: p.utm_content,
    yclid: p.yclid,
    gclid: p.gclid,
  });
  const fields = { ...touch, landingPath: h.path };

  const session = await db.analyticsSession.findUnique({ where: { id: h.sid }, select: { id: true, visitorId: true, recorded: true } });
  let recorded = false;
  if (session && session.visitorId === h.vid) {
    recorded = !!session.recorded;
    await db.analyticsSession.update({
      where: { id: h.sid },
      data: { pageViews: { increment: 1 }, lastSeenAt: now },
    });
  } else if (!session) {
    try {
      recorded = !!h.record;
      await db.analyticsSession.create({
        data: { id: h.sid, visitorId: h.vid, startedAt: now, lastSeenAt: now, device: h.device ?? "", recorded, ...fields },
      });
    } catch {
      // параллельный запрос уже создал эту сессию
    }
  }

  const visitor = await db.analyticsVisitor.findUnique({ where: { id: h.vid }, select: { id: true, userId: true } });
  if (!visitor) {
    try {
      await db.analyticsVisitor.create({
        data: {
          id: h.vid,
          firstSeenAt: now,
          lastSeenAt: now,
          ...fields,
          ...(h.userId ? { userId: h.userId, linkedAt: now } : {}),
        },
      });
    } catch {
      /* создан параллельным запросом */
    }
    return { recorded };
  }
  const data: Record<string, unknown> = { lastSeenAt: now };
  if (h.userId && !visitor.userId) {
    data.userId = h.userId;
    data.linkedAt = now;
  }
  await db.analyticsVisitor.update({ where: { id: h.vid }, data });
  return { recorded };
}

/** Привязывает посетителя (по cookie) к пользователю. Уже привязанного не перезаписывает: источник — первый. */
export async function linkVisitorToUser(vid: string | null | undefined, userId: string): Promise<void> {
  if (!vid || !/^[A-Za-z0-9_-]{16,64}$/.test(vid)) return;
  try {
    await db.analyticsVisitor.updateMany({
      where: { id: vid, userId: null },
      data: { userId, linkedAt: new Date() },
    });
  } catch {
    // таблицы может ещё не быть — на регистрацию и оплату это влиять не должно
  }
}

/** При удалении аккаунта отвязывает от него посетителя: обезличенная статистика остаётся, связь с человеком — нет */
export async function unlinkUserFromAnalytics(userId: string): Promise<void> {
  try {
    await db.analyticsVisitor.updateMany({ where: { userId }, data: { userId: null } });
  } catch {
    // таблицы может ещё не быть
  }
}

export function vidFromCookieHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = header.match(/(?:^|;\s*)mn_vid=([A-Za-z0-9_-]{16,64})/);
  return m ? m[1] : null;
}

export async function pruneAnalytics(keepDays = 400): Promise<number> {
  const cutoff = new Date(Date.now() - keepDays * 86400000);
  let n = 0;
  try {
    n = (await db.analyticsSession.deleteMany({ where: { startedAt: { lt: cutoff } } })).count ?? 0;
    // Записи сессий тяжёлые — хранятся 30 дней; агрегаты карт — полгода
    await db.analyticsReplayChunk.deleteMany({ where: { at: { lt: new Date(Date.now() - 30 * 86400000) } } });
    const heatCutoff = new Date(Date.now() - 180 * 86400000);
    await db.analyticsClick.deleteMany({ where: { lastAt: { lt: heatCutoff } } });
    await db.analyticsScroll.deleteMany({ where: { lastAt: { lt: heatCutoff } } });
  } catch {
    /* таблиц может ещё не быть */
  }
  return n;
}

const VISITOR_SEL = {
  id: true, firstSeenAt: true, userId: true, channel: true, source: true, medium: true,
  campaign: true, term: true, content: true, referrerHost: true, landingPath: true,
};
const SESSION_SEL = {
  id: true, visitorId: true, startedAt: true, pageViews: true, channel: true, source: true,
  medium: true, campaign: true, landingPath: true,
};

export async function loadReport(range: Range): Promise<Report> {
  const { from, to } = range;

  const sessions = (await db.analyticsSession.findMany({
    where: { startedAt: { gte: from, lt: to } },
    select: SESSION_SEL,
    take: 300000,
  })) as SessionRow[];
  const newVisitors = (await db.analyticsVisitor.findMany({
    where: { firstSeenAt: { gte: from, lt: to } },
    select: VISITOR_SEL,
    take: 300000,
  })) as VisitorRow[];

  // Все успешные платежи: из них берём первый у каждого пользователя
  const payments = (await prisma.payment.findMany({
    where: { status: "succeeded" },
    orderBy: { createdAt: "asc" },
    select: { userId: true, planId: true, amountKopecks: true, createdAt: true, user: { select: { email: true } } },
  })) as { userId: string; planId: string; amountKopecks: number; createdAt: Date; user: { email: string } }[];
  const firstByUser = new Map<string, (typeof payments)[number]>();
  for (const p of payments) if (!firstByUser.has(p.userId)) firstByUser.set(p.userId, p);
  const paidEverUsers = new Set(firstByUser.keys());
  const firstPayments = Array.from(firstByUser.values())
    .filter((p) => p.createdAt >= from && p.createdAt < to)
    .map((p) => ({
      userId: p.userId,
      email: p.user?.email ?? "",
      planId: getPlan(p.planId as never)?.name ?? p.planId,
      amountKopecks: p.amountKopecks,
      createdAt: p.createdAt,
    }));

  const users = (await prisma.user.findMany({
    where: { createdAt: { gte: from, lt: to } },
    select: { id: true, createdAt: true },
  })) as { id: string; createdAt: Date }[];

  // Посетители, привязанные к тем, кто зарегистрировался или оплатил за период
  const userIds = Array.from(new Set([...users.map((u) => u.id), ...firstPayments.map((p) => p.userId), ...newVisitors.filter((v) => v.userId).map((v) => v.userId as string)]));
  const linkedVisitors = userIds.length
    ? ((await db.analyticsVisitor.findMany({ where: { userId: { in: userIds } }, select: VISITOR_SEL })) as VisitorRow[])
    : [];
  const linkedSessions = linkedVisitors.length
    ? ((await db.analyticsSession.findMany({
        where: { visitorId: { in: linkedVisitors.map((v) => v.id) } },
        select: SESSION_SEL,
        take: 100000,
      })) as SessionRow[])
    : [];
  const linkedUserIds = new Set(linkedVisitors.map((v) => v.userId as string));

  return buildReport({
    from, to, sessions, newVisitors, linkedVisitors, linkedSessions, firstPayments, users, paidEverUsers, linkedUserIds,
  });
}


// ───────────── настройки ─────────────

export interface AnalyticsSettings {
  replayEnabled: boolean;
  /** Доля сессий, которые записываются, % */
  replayPercent: number;
}
let settingsCache: { at: number; value: AnalyticsSettings } | null = null;

export async function getSettings(fresh = false): Promise<AnalyticsSettings> {
  if (!fresh && settingsCache && Date.now() - settingsCache.at < 60_000) return settingsCache.value;
  let value: AnalyticsSettings = { replayEnabled: true, replayPercent: 100 };
  try {
    const rows = (await db.analyticsSetting.findMany({})) as { key: string; value: string }[];
    for (const r of rows) {
      if (r.key === "replay_enabled") value.replayEnabled = r.value !== "0";
      if (r.key === "replay_percent") {
        const n = Number(r.value);
        if (Number.isFinite(n)) value.replayPercent = Math.min(100, Math.max(1, Math.round(n)));
      }
    }
  } catch {
    value = { replayEnabled: true, replayPercent: 100 };
  }
  settingsCache = { at: Date.now(), value };
  return value;
}

export async function saveSettings(v: AnalyticsSettings): Promise<AnalyticsSettings> {
  const pct = Math.min(100, Math.max(1, Math.round(Number(v.replayPercent) || 100)));
  const rows: [string, string][] = [["replay_enabled", v.replayEnabled ? "1" : "0"], ["replay_percent", String(pct)]];
  for (const [key, value] of rows) {
    await db.analyticsSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  settingsCache = null;
  return getSettings(true);
}

// ───────────── карты кликов и скролла ─────────────

const clickId = (path: string, device: string, c: ClickIn) =>
  createHash("sha1").update([path, device, c.s, c.x, c.y].join("|")).digest("hex");

export async function recordBehavior(input: { path: string; device: Device; clicks: ClickIn[]; scrollBucket: number | null }): Promise<void> {
  const now = new Date();
  for (const c of input.clicks) {
    const id = clickId(input.path, input.device, c);
    try {
      await db.analyticsClick.upsert({
        where: { id },
        create: { id, path: input.path, device: input.device, selector: c.s, xb: c.x, yb: c.y, count: 1, lastAt: now },
        update: { count: { increment: 1 }, lastAt: now },
      });
    } catch {
      /* параллельная вставка той же ячейки — не страшно */
    }
  }
  if (input.scrollBucket !== null) {
    const b = Math.min(10, Math.max(0, Math.floor(input.scrollBucket)));
    const id = createHash("sha1").update([input.path, input.device, b].join("|")).digest("hex");
    try {
      await db.analyticsScroll.upsert({
        where: { id },
        create: { id, path: input.path, device: input.device, bucket: b, count: 1, lastAt: now },
        update: { count: { increment: 1 }, lastAt: now },
      });
    } catch {
      /* то же */
    }
  }
}

export interface HeatPageRow {
  path: string;
  device: string;
  clicks: number;
  views: number;
}

export async function listHeatPages(): Promise<HeatPageRow[]> {
  const map = new Map<string, HeatPageRow>();
  const get = (path: string, device: string) => {
    const k = path + "\u0001" + device;
    let r = map.get(k);
    if (!r) map.set(k, (r = { path, device, clicks: 0, views: 0 }));
    return r;
  };
  const clicks = (await db.analyticsClick.findMany({ select: { path: true, device: true, count: true }, take: 100000 })) as { path: string; device: string; count: number }[];
  for (const c of clicks) get(c.path, c.device).clicks += c.count;
  const scroll = (await db.analyticsScroll.findMany({ select: { path: true, device: true, count: true }, take: 100000 })) as { path: string; device: string; count: number }[];
  for (const c of scroll) get(c.path, c.device).views += c.count;
  return Array.from(map.values()).sort((a, b) => b.views + b.clicks - (a.views + a.clicks));
}

export async function loadHeat(path: string, device: Device) {
  const clicks = (await db.analyticsClick.findMany({
    where: { path, device },
    select: { selector: true, xb: true, yb: true, count: true },
    take: 20000,
  })) as { selector: string; xb: number; yb: number; count: number }[];
  const scroll = (await db.analyticsScroll.findMany({ where: { path, device }, select: { bucket: true, count: true }, take: 50 })) as { bucket: number; count: number }[];
  const hist = new Array(11).fill(0);
  for (const r of scroll) if (r.bucket >= 0 && r.bucket <= 10) hist[r.bucket] += r.count;
  return { grid: CLICK_GRID, clicks, scrollHist: hist };
}

// ───────────── вебвизор ─────────────

export const REPLAY_MAX_CHUNK_BYTES = 1_500_000;
export const REPLAY_MAX_CHUNKS = 400;

/** Сохраняет кусок записи; возвращает false, если сессия не записывается или лимит исчерпан */
export async function saveReplayChunk(vid: string, sid: string, eventsJson: string): Promise<boolean> {
  const session = await db.analyticsSession.findUnique({ where: { id: sid }, select: { visitorId: true, recorded: true } });
  if (!session || session.visitorId !== vid || !session.recorded) return false;
  const used = await db.analyticsReplayChunk.count({ where: { sessionId: sid } });
  if (used >= REPLAY_MAX_CHUNKS) return false;
  const data = gzipSync(Buffer.from(eventsJson, "utf8"));
  await db.analyticsReplayChunk.create({ data: { sessionId: sid, bytes: data.length, data, at: new Date() } });
  return true;
}

export async function listReplays(range: Range, limit = 100) {
  const sessions = (await db.analyticsSession.findMany({
    where: { recorded: true, startedAt: { gte: range.from, lt: range.to } },
    select: { id: true, visitorId: true, startedAt: true, lastSeenAt: true, pageViews: true, device: true, channel: true, source: true, campaign: true, landingPath: true },
    take: 1000,
  })) as (SessionRow & { lastSeenAt: Date; device: string; visitorId: string })[];
  if (!sessions.length) return [];
  const chunks = (await db.analyticsReplayChunk.findMany({ where: { sessionId: { in: sessions.map((s) => s.id) } }, select: { sessionId: true, bytes: true }, take: 100000 })) as { sessionId: string; bytes: number }[];
  const withData = new Map<string, number>();
  for (const c of chunks) withData.set(c.sessionId, (withData.get(c.sessionId) ?? 0) + c.bytes);
  const visitors = (await db.analyticsVisitor.findMany({ where: { id: { in: sessions.map((s) => s.visitorId) } }, select: { id: true, userId: true }, take: 1000 })) as { id: string; userId: string | null }[];
  const registered = new Set(visitors.filter((v) => v.userId).map((v) => v.id));
  return sessions
    .filter((s) => withData.has(s.id))
    .sort((a, b) => +b.startedAt - +a.startedAt)
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      durationSec: Math.max(0, Math.round((+s.lastSeenAt - +s.startedAt) / 1000)),
      pageViews: s.pageViews,
      device: s.device,
      channel: s.channel,
      source: s.source,
      campaign: s.campaign,
      landingPath: s.landingPath,
      registered: registered.has(s.visitorId),
      kb: Math.round((withData.get(s.id) ?? 0) / 1024),
    }));
}

export async function loadReplayEvents(sid: string): Promise<unknown[]> {
  const chunks = (await db.analyticsReplayChunk.findMany({ where: { sessionId: sid }, orderBy: { at: "asc" }, take: REPLAY_MAX_CHUNKS })) as { data: Buffer; at: Date }[];
  chunks.sort((a, b) => +a.at - +b.at);
  const events: { timestamp?: number }[] = [];
  for (const c of chunks) {
    try {
      const part = JSON.parse(gunzipSync(Buffer.from(c.data)).toString("utf8"));
      if (Array.isArray(part)) events.push(...part);
    } catch {
      /* повреждённый кусок пропускаем */
    }
  }
  events.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  return events;
}
