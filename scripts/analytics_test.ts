import assert from "node:assert";
import { buildReport, classifyTouch, deviceFromWidth, isBehaviorPath, sanitizeClicks, scrollReach, validSelector, isBotUserAgent, mskDay, normalizePath, periodStart, resolveRange, validId } from "../lib/analyticsCore";

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; };
const own = ["m-navi.ru"];

ok("прямой заход", () => {
  const t = classifyTouch({ referrer: "", ownHosts: own });
  assert.equal(t.channel, "direct");
});
ok("внутренний переход не источник", () => {
  assert.equal(classifyTouch({ referrer: "https://m-navi.ru/blog", ownHosts: own }).channel, "direct");
  assert.equal(classifyTouch({ referrer: "https://www.m-navi.ru/", ownHosts: own }).channel, "direct");
});
ok("возврат с оплаты и входа через Яндекс не источник", () => {
  assert.equal(classifyTouch({ referrer: "https://yookassa.ru/checkout", ownHosts: own }).channel, "direct");
  assert.equal(classifyTouch({ referrer: "https://passport.yandex.ru/auth", ownHosts: own }).channel, "direct");
});
ok("поиск", () => {
  const y = classifyTouch({ referrer: "https://yandex.ru/search/?text=x", ownHosts: own });
  assert.deepEqual([y.channel, y.source], ["search", "Яндекс"]);
  assert.equal(classifyTouch({ referrer: "https://www.google.com/", ownHosts: own }).source, "Google");
  assert.equal(classifyTouch({ referrer: "https://ya.ru/", ownHosts: own }).source, "Яндекс");
});
ok("соцсети и ИИ", () => {
  assert.equal(classifyTouch({ referrer: "https://t.me/channel/1", ownHosts: own }).source, "Telegram");
  assert.equal(classifyTouch({ referrer: "https://vk.com/away.php", ownHosts: own }).channel, "social");
  assert.equal(classifyTouch({ referrer: "https://chatgpt.com/", ownHosts: own }).channel, "ai");
  assert.equal(classifyTouch({ referrer: "https://gemini.google.com/", ownHosts: own }).channel, "ai");
});
ok("другой сайт", () => {
  const t = classifyTouch({ referrer: "https://example.org/page", ownHosts: own });
  assert.deepEqual([t.channel, t.source, t.referrerHost], ["referral", "example.org", "example.org"]);
});
ok("UTM побеждает адрес перехода", () => {
  const t = classifyTouch({ referrer: "https://yandex.ru/", ownHosts: own, utm_source: "Yandex", utm_medium: "CPC", utm_campaign: "autumn_sale", utm_term: "plan", utm_content: "b1" });
  assert.deepEqual([t.channel, t.source, t.medium, t.campaign, t.term, t.content], ["paid", "yandex", "cpc", "autumn_sale", "plan", "b1"]);
});
ok("рассылка и соцсети по utm_medium", () => {
  assert.equal(classifyTouch({ utm_source: "unisender", utm_medium: "email" }).channel, "email");
  assert.equal(classifyTouch({ utm_source: "vk", utm_medium: "social" }).channel, "social");
  assert.equal(classifyTouch({ utm_source: "partner1", utm_medium: "referral" }).channel, "referral");
  assert.equal(classifyTouch({ utm_source: "x", utm_medium: "qr" }).channel, "tagged");
});
ok("yclid без меток — Яндекс Директ", () => {
  const t = classifyTouch({ yclid: "123" });
  assert.deepEqual([t.channel, t.source], ["paid", "Яндекс Директ"]);
  assert.equal(classifyTouch({ gclid: "abc" }).source, "Google Ads");
});
ok("мусор в метках обрезается и чистится", () => {
  const t = classifyTouch({ utm_source: "a\u0000b".repeat(100), utm_campaign: "x".repeat(500) });
  assert.ok(t.source.length <= 60 && t.campaign.length <= 100 && !t.source.includes("\u0000"));
});
ok("роботы", () => {
  assert.equal(isBotUserAgent("Mozilla/5.0 (compatible; YandexBot/3.0)"), true);
  assert.equal(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(isBotUserAgent("curl/8.0"), true);
  assert.equal(isBotUserAgent(""), true);
  assert.equal(isBotUserAgent("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 YaBrowser/24.1 Safari/537.36"), false);
  assert.equal(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"), false);
});
ok("пути и идентификаторы", () => {
  assert.equal(normalizePath("/blog/a?x=1#h"), "/blog/a");
  assert.equal(normalizePath("/admin"), null);
  assert.equal(normalizePath("/api/x"), null);
  assert.equal(normalizePath("http://evil"), null);
  assert.equal(validId("abcdef0123456789abcdef"), true);
  assert.equal(validId("short"), false);
  assert.equal(validId("a b c d e f g h i j k l m n o"), false);
});
ok("московские сутки", () => {
  assert.equal(mskDay(new Date("2026-10-25T21:30:00Z")), "2026-10-26");
  assert.equal(periodStart(new Date("2026-10-26T10:00:00Z"), 1).toISOString(), "2026-10-25T21:00:00.000Z");
});

ok("отчёт: посетители, источники, конверсия", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const d = (s: string) => new Date(s);
  const base = { campaign: "", medium: "", term: "", content: "", referrerHost: "", landingPath: "/" };
  const mk = (id: string, visitorId: string, at: string, channel: string, source: string, pv = 2) => ({ id, visitorId, startedAt: d(at), pageViews: pv, channel, source, medium: "", campaign: "", landingPath: "/" });
  const sessions = [
    mk("s1", "A", "2026-10-24T10:00:00Z", "search", "Яндекс"),
    mk("s2", "A", "2026-10-25T10:00:00Z", "direct", "(прямой заход)"),
    mk("s3", "B", "2026-10-25T11:00:00Z", "search", "Яндекс"),
    mk("s4", "C", "2026-10-26T09:00:00Z", "paid", "yandex", 4),
  ];
  const vA = { id: "A", firstSeenAt: d("2026-10-24T10:00:00Z"), userId: "u1", channel: "search", source: "Яндекс", ...base };
  const vB = { id: "B", firstSeenAt: d("2026-10-25T11:00:00Z"), userId: null, channel: "search", source: "Яндекс", ...base };
  const vC = { id: "C", firstSeenAt: d("2026-10-26T09:00:00Z"), userId: "u2", channel: "paid", source: "yandex", ...base, campaign: "autumn" };
  const r = buildReport({
    from: periodStart(now, 7), to: new Date(periodStart(now, 1).getTime() + 86400000), sessions,
    newVisitors: [vA, vB, vC], linkedVisitors: [vA, vC],
    linkedSessions: sessions.filter((s) => s.visitorId !== "B"),
    firstPayments: [
      { userId: "u1", email: "a@x.ru", planId: "Премиум", amountKopecks: 699000, createdAt: d("2026-10-25T12:00:00Z") },
      { userId: "u9", email: "old@x.ru", planId: "Старт", amountKopecks: 199000, createdAt: d("2026-10-25T13:00:00Z") },
    ],
    users: [{ id: "u1", createdAt: d("2026-10-24T10:05:00Z") }, { id: "u2", createdAt: d("2026-10-26T09:05:00Z") }, { id: "u7", createdAt: d("2026-10-20T00:00:00Z") }],
    paidEverUsers: new Set(["u1", "u9"]),
    linkedUserIds: new Set(["u1", "u2"]),
  });
  assert.equal(r.totals.uniqueVisitors, 3);
  assert.equal(r.totals.sessions, 4);
  assert.equal(r.totals.newVisitors, 3);
  assert.equal(r.totals.registrations, 3);
  assert.equal(r.totals.registrationsAttributed, 2);
  assert.equal(r.totals.paid, 2);
  assert.equal(r.totals.paidAttributed, 1);
  assert.equal(r.daily.length, 7);
  assert.equal(r.daily.find((x) => x.day === "2026-10-25")!.visitors, 2);
  assert.equal(r.channels[0].channel, "search");
  const yand = r.sources.find((s) => s.source === "Яндекс")!;
  assert.deepEqual([yand.visitors, yand.sessions], [2, 2]);
  const ch = r.cohorts.find((c) => c.source === "Яндекс")!;
  assert.deepEqual([ch.newVisitors, ch.registered, ch.paid, ch.conversionPct], [2, 1, 1, 50]);
  const paid = r.conversions.find((c) => c.email === "a@x.ru")!;
  assert.equal(paid.known, true);
  assert.equal(paid.first!.source, "Яндекс");
  assert.equal(paid.last!.channel, "direct"); // последний визит перед оплатой — прямой заход 25.10
  assert.equal(paid.daysToPay, 1);
  const unknown = r.conversions.find((c) => c.email === "old@x.ru")!;
  assert.equal(unknown.known, false);
  assert.equal(unknown.first, null);
});
ok("пустой отчёт", () => {
  const r = buildReport({ from: periodStart(new Date(), 1), to: new Date(periodStart(new Date(), 1).getTime() + 86400000), sessions: [], newVisitors: [], linkedVisitors: [], linkedSessions: [], firstPayments: [], users: [] });
  assert.equal(r.totals.uniqueVisitors, 0);
  assert.equal(r.daily.length, 1);
  assert.equal(r.totals.conversionPct, 0);
});

ok("произвольный период", () => {
  const now = new Date("2026-10-26T10:00:00Z");
  const r = resolveRange({ from: "2026-10-01", to: "2026-10-10" }, now);
  assert.equal(r.days, 10);
  assert.equal(r.from.toISOString(), "2026-09-30T21:00:00.000Z");
  assert.equal(r.to.toISOString(), "2026-10-10T21:00:00.000Z");
  // одна дата без конца — до сегодняшнего дня
  const r2 = resolveRange({ from: "2026-10-20" }, now);
  assert.equal(r2.days, 7);
  // будущее обрезается сегодняшним днём
  const r3 = resolveRange({ from: "2026-10-25", to: "2027-01-01" }, now);
  assert.equal(r3.days, 2);
  // перепутанные даты не ломают отчёт
  const r4 = resolveRange({ from: "2026-10-20", to: "2026-10-10" }, now);
  assert.equal(r4.days, 1);
  // слишком длинный период обрезается до 366 дней
  assert.equal(resolveRange({ from: "2020-01-01" }, now).days, 366);
  // мусор → 30 дней
  assert.equal(resolveRange({ from: "abc", days: 5 }, now).days, 30);
  assert.equal(resolveRange({ days: 7 }, now).days, 7);
  const rep = buildReport({ from: r.from, to: r.to, sessions: [], newVisitors: [], linkedVisitors: [], linkedSessions: [], firstPayments: [], users: [] });
  assert.equal(rep.daily.length, 10);
  assert.equal(rep.toDay, "2026-10-10");
  assert.equal(rep.daily[0].day, "2026-10-01");
});

ok("страницы для записи и карт", () => {
  for (const p of ["/", "/blog", "/blog/some-post", "/about", "/prodvizhenie/b2b", "/oferta", "/privacy"]) assert.equal(isBehaviorPath(p), true, p);
  for (const p of ["/account", "/business/1", "/admin", "/forgot-password", "/reset-password", "/blogger", "/api/x", "", null]) assert.equal(isBehaviorPath(p as string), false, String(p));
});
ok("устройство по ширине", () => {
  assert.equal(deviceFromWidth(390), "mobile");
  assert.equal(deviceFromWidth(820), "tablet");
  assert.equal(deviceFromWidth(1440), "desktop");
  assert.equal(deviceFromWidth(NaN), "desktop");
});
ok("селекторы кликов", () => {
  assert.equal(validSelector("body:nth-of-type(1) > div:nth-of-type(2) > a:nth-of-type(3)"), true);
  assert.equal(validSelector("#hero > button:nth-of-type(1)"), true);
  assert.equal(validSelector("div<script>"), false);
  assert.equal(validSelector("a[href='x']"), false);
  assert.equal(validSelector("x".repeat(301)), false);
  assert.equal(validSelector(""), false);
});
ok("клики очищаются и ограничиваются", () => {
  const r = sanitizeClicks([{ s: "div:nth-of-type(1)", x: 5.7, y: 99 }, { s: "<b>", x: 1, y: 1 }, { s: "a:nth-of-type(1)", x: -3, y: "z" }, null]);
  assert.deepEqual(r, [{ s: "div:nth-of-type(1)", x: 5, y: 19 }]);
  assert.equal(sanitizeClicks(Array.from({ length: 100 }, () => ({ s: "p:nth-of-type(1)", x: 1, y: 1 }))).length, 30);
  assert.deepEqual(sanitizeClicks("мусор"), []);
});
ok("глубина скролла", () => {
  // 10 просмотров: 2 остались сверху, 3 дошли до 30–40%, 5 долистали до конца
  const hist = [2, 0, 0, 3, 0, 0, 0, 0, 0, 0, 5];
  const { views, reach } = scrollReach(hist);
  assert.equal(views, 10);
  assert.equal(reach[0], 100);
  assert.equal(reach[3], 80);
  assert.equal(reach[4], 50);
  assert.equal(reach[9], 50);
  assert.deepEqual(scrollReach([]).reach, new Array(10).fill(0));
});

console.log(`ВСЕ ТЕСТЫ ПРОШЛИ (${n})`);
