import { mskDayWindow, visitorsByChannel, buildDailyMessage, formatRub } from "../lib/dailyReportCore";
let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };

const w = mskDayWindow(new Date("2026-11-03T06:00:00Z")); // 09:00 МСК 3 ноября
ok(w.label === "02.11.2026", "вчерашний день по Москве");
ok(w.from.toISOString() === "2026-11-01T21:00:00.000Z" && w.to.toISOString() === "2026-11-02T21:00:00.000Z", "границы суток по МСК");
const w2 = mskDayWindow(new Date("2026-11-02T22:30:00Z")); // уже 3 ноября по Москве, 01:30
ok(w2.label === "02.11.2026", "после полуночи по МСК, но до полуночи UTC");
ok(mskDayWindow(new Date(), "2026-01-05").label === "05.01.2026", "заданная дата");

const t = (h: number) => new Date(Date.UTC(2026, 10, 2, h));
const v = visitorsByChannel([
  { visitorId: "a", channel: "search", startedAt: t(5) },
  { visitorId: "a", channel: "direct", startedAt: t(9) },
  { visitorId: "b", channel: "paid", startedAt: t(6) },
  { visitorId: "c", channel: "search", startedAt: t(7) },
]);
ok(v.total === 3, "уникальные посетители");
ok(v.rows[0].channel === "search" && v.rows[0].visitors === 2, "канал = первый визит за день");
ok(formatRub(123456) === "1 235 ₽", "формат рублей");

const names: Record<string, string> = { trial: "Пробный", start: "Старт" };
const msg = buildDailyMessage("02.11.2026", {
  sessions: [{ visitorId: "a", channel: "paid", startedAt: t(5) }],
  payments: [{ planId: "start", amountKopecks: 99000 }, { planId: "start", amountKopecks: 99000 }],
  newUsers: [{ planId: "trial" }, { planId: "trial" }, { planId: "start" }],
}, (id) => names[id] ?? id);
ok(msg.includes("Посетители: 1") && msg.includes("Платная реклама — 1"), "посетители в тексте");
ok(msg.includes("Выручка: 1 980 ₽") && msg.includes("Старт — 2"), "выручка и тарифы");
ok(msg.includes("Новые пользователи: 3") && msg.includes("Пробный — 2"), "новые пользователи");
const empty = buildDailyMessage("x", { sessions: [], payments: [], newUsers: [] }, (i) => i);
ok(empty.includes("Визитов не было") && empty.includes("Оплат не было") && empty.includes("Регистраций не было"), "пустой день");
ok(buildDailyMessage("x", { sessions: [{ visitorId: "a", channel: "<b>", startedAt: t(1) }], payments: [], newUsers: [] }, (i) => i).includes("&lt;b&gt;"), "экранирование HTML");
if (fails) process.exit(1);
console.log("все проверки пройдены");
