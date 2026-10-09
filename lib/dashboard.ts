// Расчёты для дашборда в личном кабинете. Всё — чистые функции без обращения к
// браузеру, чтобы их можно было проверить тестами (scripts/seo_test.ts).
// Источник данных — то, что пользователь вносит сам (lib/funnel.ts) и отметки
// чек-листа (lib/progressHistory.ts). Ничего не подключается автоматически.

import type { FunnelSnapshot } from "./funnel";
import type { ProgressPoint } from "./progressHistory";

export interface PeriodMetrics {
  id: string;
  label: string; // как ввёл пользователь
  short: string; // короткая подпись для оси
  visitors: number;
  leads: number;
  sales: number;
  repeat: number;
  /** Конверсии в % с одним знаком; null, если делить не на что. */
  toLeads: number | null;
  toSales: number | null;
  toRepeat: number | null;
  adSpend: number | null;
  /** Стоимость заявки и продажи, ₽ (нужен рекламный бюджет и ненулевое число). */
  costPerLead: number | null;
  costPerSale: number | null;
  avgReceipt: number | null;
  /** Оценочная выручка = продажи × средний чек (повторные не учитываются). */
  revenue: number | null;
  reviewsCount: number | null;
  reviewsRating: number | null;
}

export function pct(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}

function ratio(spend: number | null, count: number): number | null {
  if (spend === null || spend <= 0 || !count) return null;
  return Math.round(spend / count);
}

const MONTH_SHORT: Record<string, string> = {
  январь: "Янв", февраль: "Фев", март: "Мар", апрель: "Апр", май: "Май", июнь: "Июн",
  июль: "Июл", август: "Авг", сентябрь: "Сен", октябрь: "Окт", ноябрь: "Ноя", декабрь: "Дек",
};

/** «Сентябрь 2026» → «Сен 26»; любой другой текст обрезается до 9 символов. */
export function shortLabel(label: string): string {
  const t = label.trim();
  const m = t.match(/^([А-Яа-яЁё]+)\s+(\d{4})$/);
  if (m && MONTH_SHORT[m[1].toLowerCase()]) return `${MONTH_SHORT[m[1].toLowerCase()]} ${m[2].slice(2)}`;
  return t.length > 9 ? `${t.slice(0, 8)}…` : t || "—";
}

export function periodMetrics(snapshots: FunnelSnapshot[]): PeriodMetrics[] {
  return [...snapshots]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((s) => {
      const adSpend = s.adSpend && s.adSpend > 0 ? s.adSpend : null;
      const avgReceipt = s.avgReceipt && s.avgReceipt > 0 ? s.avgReceipt : null;
      return {
        id: s.id,
        label: s.label,
        short: shortLabel(s.label),
        visitors: s.visitors,
        leads: s.leads,
        sales: s.sales,
        repeat: s.repeat,
        toLeads: pct(s.leads, s.visitors),
        toSales: pct(s.sales, s.leads),
        toRepeat: pct(s.repeat, s.sales),
        adSpend,
        costPerLead: ratio(adSpend, s.leads),
        costPerSale: ratio(adSpend, s.sales),
        avgReceipt,
        revenue: avgReceipt !== null && s.sales > 0 ? Math.round(avgReceipt * s.sales) : null,
        reviewsCount: s.reviewsCount && s.reviewsCount > 0 ? s.reviewsCount : null,
        reviewsRating: s.reviewsRating && s.reviewsRating > 0 ? s.reviewsRating : null,
      };
    });
}

/** Последние N периодов (0 или больше длины = все). */
export function lastPeriods<T>(items: T[], n: number): T[] {
  return n > 0 && n < items.length ? items.slice(-n) : items;
}

export interface Delta {
  /** Изменение в % к предыдущему периоду (для процентных показателей — в п.п.). */
  value: number;
  unit: "%" | "п.п.";
  direction: "up" | "down" | "flat";
}

/** Изменение к предыдущему периоду. null — сравнивать не с чем. */
export function delta(cur: number | null, prev: number | null, kind: "relative" | "points" = "relative"): Delta | null {
  if (cur === null || prev === null) return null;
  if (kind === "points") {
    const v = Math.round((cur - prev) * 10) / 10;
    return { value: v, unit: "п.п.", direction: v > 0 ? "up" : v < 0 ? "down" : "flat" };
  }
  if (prev === 0) return cur === 0 ? { value: 0, unit: "%", direction: "flat" } : null;
  const v = Math.round(((cur - prev) / prev) * 1000) / 10;
  return { value: v, unit: "%", direction: v > 0 ? "up" : v < 0 ? "down" : "flat" };
}

/** Хорошо ли это для бизнеса: для стоимости рост — плохо. */
export function deltaTone(d: Delta | null, lowerIsBetter = false): "good" | "bad" | "neutral" {
  if (!d || d.direction === "flat") return "neutral";
  const up = d.direction === "up";
  return up !== lowerIsBetter ? "good" : "bad";
}

export interface DashboardSummary {
  periods: number;
  latest: PeriodMetrics | null;
  previous: PeriodMetrics | null;
}

export function summarize(metrics: PeriodMetrics[]): DashboardSummary {
  return {
    periods: metrics.length,
    latest: metrics.length ? metrics[metrics.length - 1] : null,
    previous: metrics.length > 1 ? metrics[metrics.length - 2] : null,
  };
}

/** Короткие выводы по динамике. Только факты из внесённых цифр, без причинно-следственных обещаний. */
export function buildInsights(metrics: PeriodMetrics[], progress: ProgressPoint[]): string[] {
  const out: string[] = [];
  if (metrics.length >= 2) {
    const first = metrics[0];
    const last = metrics[metrics.length - 1];
    const dl = delta(last.leads, first.leads);
    if (dl && dl.direction !== "flat") {
      out.push(
        `Заявок ${dl.direction === "up" ? "стало больше" : "стало меньше"} на ${fmtNum(Math.abs(dl.value), 1)}%: ${first.leads} в «${first.label}» → ${last.leads} в «${last.label}».`
      );
    }
    const ds = delta(last.sales, first.sales);
    if (ds && ds.direction !== "flat") {
      out.push(`Продаж ${ds.direction === "up" ? "больше" : "меньше"} на ${fmtNum(Math.abs(ds.value), 1)}% (${first.sales} → ${last.sales}).`);
    }
    if (first.costPerLead !== null && last.costPerLead !== null) {
      const dc = delta(last.costPerLead, first.costPerLead);
      if (dc && dc.direction !== "flat") {
        out.push(`Заявка ${dc.direction === "down" ? "подешевела" : "подорожала"} с ${first.costPerLead} до ${last.costPerLead} ₽.`);
      }
    }
  }
  if (progress.length >= 2) {
    const a = progress[0];
    const b = progress[progress.length - 1];
    if (b.total !== a.total) {
      out.push(`План выполнен на ${b.total}% (с ${a.date.split("-").reverse().join(".")} — ${a.total}%).`);
    }
  } else if (progress.length === 1) {
    out.push(`План выполнен на ${progress[0].total}%. Отмечайте шаги — здесь появится динамика.`);
  }
  return out;
}

/** Форматирование чисел для интерфейса. */
export function fmtNum(n: number | null, digits = 0): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("ru-RU", { maximumFractionDigits: digits });
}

export function fmtDelta(d: Delta | null): string {
  if (!d) return "";
  if (d.direction === "flat") return "без изменений";
  const sign = d.value > 0 ? "+" : "−";
  return `${sign}${fmtNum(Math.abs(d.value), 1)} ${d.unit}`;
}
