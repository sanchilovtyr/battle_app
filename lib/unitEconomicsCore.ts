// Юнит-экономика: сколько стоит привлечь клиента (CAC), сколько прибыли он приносит
// (LTV) и окупается ли реклама. Чистые функции без браузера — проверяются в
// scripts/seo_test.ts. Все цифры — оценка по тому, что вносит пользователь.

import type { FunnelSnapshot } from "./funnel";
import type { CrmClient } from "./crmCore";

export interface UnitSettings {
  /** Маржа с продажи, % (доля прибыли в чеке после себестоимости). Вводит пользователь. */
  marginPct?: number;
  /** Сколько покупок клиент делает за всё время (1 — разовая покупка). */
  purchases?: number;
}

export interface UnitInput {
  spend: number | null; // расходы на привлечение за период, ₽
  customers: number | null; // новые платящие клиенты за тот же период
  avgCheck: number | null; // средний чек, ₽
  marginPct: number | null;
  purchases: number; // ≥ 1
}

export type UnitVerdict = "good" | "weak" | "loss";

export interface UnitResult {
  cac: number | null;
  profitPerPurchase: number | null;
  /** Прибыль с клиента за всё время (с учётом маржи). Без маржи — null. */
  ltv: number | null;
  ltvCac: number | null;
  /** Прибыль с первой покупки минус стоимость привлечения. */
  firstDealProfit: number | null;
  /** За сколько покупок клиент окупает своё привлечение. */
  paybackPurchases: number | null;
  /** Больше этой цены привлекать клиента нельзя — уйдёте в минус. */
  maxCac: number | null;
  /** Ориентир «комфортной» цены привлечения: треть LTV. */
  comfortCac: number | null;
  repeatMode: boolean; // клиент покупает больше одного раза
  verdict: UnitVerdict | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const pos = (n: number | null): n is number => n !== null && Number.isFinite(n) && n > 0;

export function computeUnit(i: UnitInput): UnitResult {
  const purchases = Number.isFinite(i.purchases) && i.purchases >= 1 ? i.purchases : 1;
  const cac = pos(i.spend) && pos(i.customers) ? Math.round(i.spend / i.customers) : null;
  const profitPerPurchase =
    pos(i.avgCheck) && i.marginPct !== null && i.marginPct >= 0 ? Math.round((i.avgCheck * Math.min(i.marginPct, 100)) / 100) : null;
  const ltv = profitPerPurchase !== null ? Math.round(profitPerPurchase * purchases) : null;
  const ltvCac = ltv !== null && cac !== null && cac > 0 ? r1(ltv / cac) : null;
  const firstDealProfit = profitPerPurchase !== null && cac !== null ? profitPerPurchase - cac : null;
  const paybackPurchases =
    profitPerPurchase !== null && profitPerPurchase > 0 && cac !== null ? r1(cac / profitPerPurchase) : null;
  const repeatMode = purchases > 1;

  let verdict: UnitVerdict | null = null;
  if (repeatMode && ltvCac !== null) verdict = ltvCac >= 3 ? "good" : ltvCac >= 1 ? "weak" : "loss";
  else if (!repeatMode && firstDealProfit !== null) verdict = firstDealProfit >= 0 ? "good" : "loss";

  return {
    cac,
    profitPerPurchase,
    ltv,
    ltvCac,
    firstDealProfit,
    paybackPurchases,
    maxCac: ltv,
    comfortCac: ltv !== null ? Math.round(ltv / 3) : null,
    repeatMode,
    verdict,
  };
}

/** «Что если»: цена привлечения, чек и маржа меняются на заданные доли. */
export function scenario(i: UnitInput, d: { cacPct: number; checkPct: number; marginPoints: number }): UnitResult {
  const k = (p: number) => 1 + p / 100;
  return computeUnit({
    ...i,
    spend: i.spend !== null ? i.spend * k(d.cacPct) : null,
    avgCheck: i.avgCheck !== null ? i.avgCheck * k(d.checkPct) : null,
    marginPct: i.marginPct !== null ? Math.max(0, Math.min(100, i.marginPct + d.marginPoints)) : null,
  });
}

export interface AutoInput {
  source: "crm" | "funnel";
  label: string; // за какой период взяты данные
  spend: number;
  customers: number;
  avgCheck: number | null;
  /** Подсказка по числу покупок на клиента из воронки (1 + повторные ÷ продажи). */
  purchasesHint: number | null;
  /** Только для режима CRM: сколько продаж за те же 90 дней указано в воронке (для сверки полноты CRM). */
  funnelSales?: number;
}

const DAY = 86400000;

/** CRM, судя по всему, неполная: в воронке за тот же срок продаж заметно больше, чем оплат в CRM. */
export function crmLooksIncomplete(a: AutoInput | null): boolean {
  return !!a && a.source === "crm" && (a.funnelSales ?? 0) > a.customers * 1.3;
}

function purchasesFromFunnel(snaps: FunnelSnapshot[]): number | null {
  for (let i = snaps.length - 1; i >= 0; i--) {
    const s = snaps[i];
    if (s.sales > 0 && s.repeat >= 0) return Math.min(50, Math.round((1 + s.repeat / s.sales) * 10) / 10);
  }
  return null;
}

/** Данные для подстановки: за 90 дней (расходы из воронки + оплаты и чек из CRM) и за последний период воронки. */
export function pickAutoInputs(
  snapshots: FunnelSnapshot[],
  clients: CrmClient[],
  now: Date
): { crm: AutoInput | null; funnel: AutoInput | null } {
  const hint = purchasesFromFunnel(snapshots);
  const cutoff = now.getTime() - 90 * DAY;
  const time = (iso: string | undefined) => {
    const t = iso ? new Date(iso).getTime() : NaN;
    return Number.isFinite(t) ? t : NaN;
  };

  let crm: AutoInput | null = null;
  const won = clients.filter((c) => c.status === "won" && time(c.closedAt ?? c.updatedAt) >= cutoff);
  const spend = snapshots.filter((s) => time(s.createdAt) >= cutoff).reduce((a, s) => a + (s.adSpend ?? 0), 0);
  if (won.length > 0 && spend > 0) {
    const paid = won.filter((c) => (c.amount ?? 0) > 0);
    crm = {
      source: "crm",
      label: "последние 90 дней",
      spend,
      customers: won.length,
      avgCheck: paid.length ? Math.round(paid.reduce((a, c) => a + (c.amount ?? 0), 0) / paid.length) : null,
      purchasesHint: hint,
      funnelSales: snapshots.filter((s) => time(s.createdAt) >= cutoff).reduce((a, s) => a + (s.sales ?? 0), 0),
    };
  }

  let funnel: AutoInput | null = null;
  for (let i = snapshots.length - 1; i >= 0; i--) {
    const s = snapshots[i];
    if ((s.adSpend ?? 0) > 0 && s.sales > 0) {
      funnel = {
        source: "funnel",
        label: s.label || "последний период",
        spend: s.adSpend as number,
        customers: s.sales,
        avgCheck: s.avgReceipt && s.avgReceipt > 0 ? s.avgReceipt : null,
        purchasesHint: hint,
      };
      break;
    }
  }
  return { crm, funnel };
}
