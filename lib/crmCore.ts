// Лёгкая CRM: список клиентов, которых бизнес получил, и расчёт эффективности.
// Чистые функции без обращения к браузеру — проверяются в scripts/seo_test.ts.
// Данные вносит сам пользователь; сервис ни к чему не подключается автоматически.

import type { FunnelChannel } from "./funnel";

export type ClientStatus = "new" | "in_work" | "won" | "lost";

export const CLIENT_STATUSES: readonly ClientStatus[] = ["new", "in_work", "won", "lost"] as const;

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  new: "Новый",
  in_work: "В работе",
  won: "Оплатил",
  lost: "Не купил",
};

export const CRM_SOURCES: readonly FunnelChannel[] = [
  "yandex_direct",
  "vk_ads",
  "maps_reviews",
  "referral",
  "social_organic",
  "offline",
  "other",
] as const;

export const MAX_CLIENTS = 300;

export interface CrmClient {
  id: string;
  createdAt: string; // когда клиент появился (можно указать задним числом)
  updatedAt: string;
  name: string;
  contact: string; // телефон, Telegram, почта — как удобно
  source: FunnelChannel;
  /** Пришёл благодаря плану и действиям из сервиса — именно эти клиенты считаются «заслугой» сервиса. */
  viaService: boolean;
  status: ClientStatus;
  amount?: number; // сумма оплаты, ₽ (для статуса «Оплатил»)
  note?: string;
  closedAt?: string; // когда стал «Оплатил» или «Не купил»
}

export interface SourceRow {
  source: FunnelChannel;
  total: number;
  won: number;
  revenue: number;
}

export interface CrmStats {
  total: number;
  active: number; // новые + в работе
  won: number;
  lost: number;
  revenue: number;
  avgCheck: number | null;
  /** Доля оплативших среди всех клиентов, % с одним знаком. */
  conversion: number | null;
  service: { total: number; won: number; revenue: number; monthWon: number; monthRevenue: number };
  /** Во сколько раз выручка от клиентов сервиса за месяц превысила месячную цену тарифа; null — нечего сравнивать. */
  paybackMonth: number | null;
  /** Сумма ожидаемых сделок: у клиентов со статусами «Новый» и «В работе». */
  pipeline: number;
  bySource: SourceRow[];
}

/** «4 490 ₽» → 4490. */
export function parsePrice(price: string | undefined): number {
  const n = Number(String(price ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function sameMonth(iso: string | undefined, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function computeCrmStats(clients: CrmClient[], now: Date, monthlyPlanPrice = 0): CrmStats {
  let won = 0;
  let lost = 0;
  let active = 0;
  let revenue = 0;
  let pipeline = 0;
  const service = { total: 0, won: 0, revenue: 0, monthWon: 0, monthRevenue: 0 };
  const map = new Map<FunnelChannel, SourceRow>();

  for (const c of clients) {
    const amount = c.status === "won" ? c.amount ?? 0 : 0;
    if (c.status === "won") {
      won += 1;
      revenue += amount;
    } else if (c.status === "lost") lost += 1;
    else {
      active += 1;
      pipeline += c.amount ?? 0;
    }

    if (c.viaService) {
      service.total += 1;
      if (c.status === "won") {
        service.won += 1;
        service.revenue += amount;
        if (sameMonth(c.closedAt ?? c.updatedAt, now)) {
          service.monthWon += 1;
          service.monthRevenue += amount;
        }
      }
    }

    const row = map.get(c.source) ?? { source: c.source, total: 0, won: 0, revenue: 0 };
    row.total += 1;
    if (c.status === "won") {
      row.won += 1;
      row.revenue += amount;
    }
    map.set(c.source, row);
  }

  const total = clients.length;
  return {
    total,
    active,
    won,
    lost,
    revenue,
    avgCheck: won > 0 && revenue > 0 ? Math.round(revenue / won) : null,
    conversion: total > 0 ? Math.round((won / total) * 1000) / 10 : null,
    service,
    paybackMonth:
      monthlyPlanPrice > 0 && service.monthRevenue > 0 ? Math.round((service.monthRevenue / monthlyPlanPrice) * 10) / 10 : null,
    pipeline,
    bySource: Array.from(map.values()).sort((a, b) => b.revenue - a.revenue || b.total - a.total),
  };
}

/** Применить смену статуса: фиксируем дату закрытия и не храним сумму у тех, кто не оплатил. */
export function withStatus(c: CrmClient, status: ClientStatus, nowIso: string): CrmClient {
  const closed = status === "won" || status === "lost";
  const next: CrmClient = { ...c, status, updatedAt: nowIso };
  if (closed) next.closedAt = c.closedAt && (c.status === "won" || c.status === "lost") ? c.closedAt : nowIso;
  else delete next.closedAt;
  if (status === "lost") delete next.amount; // у «Не купил» суммы нет; у «Нового» и «В работе» это ожидаемая сумма
  return next;
}

const csvCell = (v: string | number | undefined) => {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV с разделителем «;» и BOM — открывается в Excel без настройки кодировки. */
export function clientsToCsv(clients: CrmClient[], sourceLabels: Record<string, string>): string {
  const head = ["Дата", "Имя", "Контакт", "Источник", "От сервиса", "Статус", "Сумма, ₽", "Заметка"];
  const lines = [head.join(";")];
  for (const c of clients) {
    lines.push(
      [
        c.createdAt.slice(0, 10),
        c.name,
        c.contact,
        sourceLabels[c.source] ?? c.source,
        c.viaService ? "да" : "нет",
        CLIENT_STATUS_LABELS[c.status],
        c.amount ?? "",
        c.note ?? "",
      ]
        .map(csvCell)
        .join(";")
    );
  }
  return "﻿" + lines.join("\r\n");
}
