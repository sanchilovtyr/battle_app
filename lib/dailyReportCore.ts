/**
 * Суточный отчёт в Telegram: чистые функции (без базы и сети), покрыты тестами.
 * «Сутки» — прошедший календарный день по Москве (UTC+3, переводов часов нет).
 */

import { CHANNEL_LABELS, Channel } from "./analyticsCore";

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface DayWindow {
  from: Date;
  to: Date;
  /** «02.11.2026» */
  label: string;
}

/** Окно прошедшего дня по Москве относительно момента now (или заданной даты YYYY-MM-DD) */
export function mskDayWindow(now: Date, dateStr?: string | null): DayWindow {
  let y: number, m: number, d: number;
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    [y, m, d] = dateStr.split("-").map(Number);
  } else {
    const msk = new Date(now.getTime() + MSK_OFFSET_MS);
    const prev = new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate() - 1));
    y = prev.getUTCFullYear(); m = prev.getUTCMonth() + 1; d = prev.getUTCDate();
  }
  const startUtc = Date.UTC(y, m - 1, d) - MSK_OFFSET_MS;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { from: new Date(startUtc), to: new Date(startUtc + 24 * 3600 * 1000), label: `${pad(d)}.${pad(m)}.${y}` };
}

export interface SessionLite { visitorId: string; channel: string; startedAt: Date }
export interface PaymentLite { planId: string; amountKopecks: number }
export interface UserLite { planId: string }

export interface DailyData {
  sessions: SessionLite[];
  payments: PaymentLite[];
  newUsers: UserLite[];
}

export interface ChannelCount { channel: string; label: string; visitors: number }

/** Уникальные посетители; канал — тот, с которого человек впервые пришёл в этот день */
export function visitorsByChannel(sessions: SessionLite[]): { total: number; rows: ChannelCount[] } {
  const first = new Map<string, SessionLite>();
  for (const s of sessions) {
    const cur = first.get(s.visitorId);
    if (!cur || s.startedAt < cur.startedAt) first.set(s.visitorId, s);
  }
  const counts = new Map<string, number>();
  first.forEach((s) => counts.set(s.channel, (counts.get(s.channel) ?? 0) + 1));
  const rows = Array.from(counts.entries())
    .map(([channel, visitors]) => ({ channel, label: CHANNEL_LABELS[channel as Channel] ?? channel, visitors }))
    .sort((a, b) => b.visitors - a.visitors);
  return { total: first.size, rows };
}

export function formatRub(kopecks: number): string {
  const rub = Math.round(kopecks / 100);
  return rub.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function groupCount(items: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

/** Текст сообщения (HTML для Telegram). planName: id тарифа → название */
export function buildDailyMessage(label: string, data: DailyData, planName: (id: string) => string): string {
  const v = visitorsByChannel(data.sessions);
  const lines: string[] = [`<b>Ключевое слово — итоги за ${escapeHtml(label)}</b>`, ""];

  lines.push(`<b>Посетители: ${v.total}</b>`);
  if (v.rows.length === 0) lines.push("Визитов не было");
  for (const r of v.rows) lines.push(`• ${escapeHtml(r.label)} — ${r.visitors}`);

  const revenue = data.payments.reduce((s, p) => s + p.amountKopecks, 0);
  lines.push("", `<b>Выручка: ${formatRub(revenue)}</b>`);
  if (data.payments.length === 0) lines.push("Оплат не было");
  else {
    lines.push(`Оплат: ${data.payments.length}`);
    const byPlan = new Map<string, { n: number; sum: number }>();
    for (const p of data.payments) {
      const k = planName(p.planId);
      const c = byPlan.get(k) ?? { n: 0, sum: 0 };
      c.n += 1; c.sum += p.amountKopecks;
      byPlan.set(k, c);
    }
    byPlan.forEach((c, k) => lines.push(`• ${escapeHtml(k)} — ${c.n} (${formatRub(c.sum)})`));
  }

  lines.push("", `<b>Новые пользователи: ${data.newUsers.length}</b>`);
  if (data.newUsers.length === 0) lines.push("Регистраций не было");
  for (const [plan, n] of groupCount(data.newUsers.map((u) => planName(u.planId)))) {
    lines.push(`• ${escapeHtml(plan)} — ${n}`);
  }
  return lines.join("\n");
}
