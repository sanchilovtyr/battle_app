// Тестовые данные для витрины «Так выглядит ваш кабинет» на главной.
// Бизнес вымышленный, цифры придуманы для демонстрации и нигде не выдаются за
// реальные результаты. Всё считается теми же чистыми функциями, что и в кабинете,
// поэтому витрина показывает настоящий интерфейс, а не картинки.

import { MODULES } from "./modules";
import { generatePlan } from "./ruleEngine";
import type { ChecklistState } from "./checklist";
import type { FunnelSnapshot } from "./funnel";
import { makeProgressPoint, type ProgressPoint } from "./progressHistory";
import { computeReadiness } from "./readiness";

export const DEMO_BUSINESS = {
  id: "demo",
  name: "Студия «Лотос» (демо)",
  businessType: "Услуги",
  createdAt: "2026-04-02T09:00:00.000Z",
};

export const DEMO_PLAN = generatePlan(MODULES, {
  businessType: "services",
  goal: "repeat_sales",
  budget: "20to100",
  geo: "local",
});

/** Отмечено: весь «Фундамент» и половина первого канала трафика. */
export const DEMO_CHECKLIST: ChecklistState = (() => {
  const state: ChecklistState = {};
  for (const e of DEMO_PLAN.foundation) state[e.module.id] = e.module.steps.map(() => true);
  const first = DEMO_PLAN.traffic[0];
  if (first) state[first.module.id] = first.module.steps.map((_, i) => i < Math.ceil(first.module.steps.length / 2));
  return state;
})();

const snap = (
  id: string,
  at: string,
  label: string,
  visitors: number,
  leads: number,
  sales: number,
  repeat: number,
  adSpend: number,
  avgReceipt: number,
  reviewsCount: number,
  reviewsRating: number
): FunnelSnapshot => ({ id, createdAt: at, label, visitors, leads, sales, repeat, adSpend, avgReceipt, reviewsCount, reviewsRating });

export const DEMO_SNAPSHOTS: FunnelSnapshot[] = [
  snap("d1", "2026-05-03T09:00:00.000Z", "Апрель 2026", 410, 29, 8, 1, 21000, 2300, 11, 4.4),
  snap("d2", "2026-06-03T09:00:00.000Z", "Май 2026", 470, 36, 10, 2, 22000, 2300, 17, 4.5),
  snap("d3", "2026-07-03T09:00:00.000Z", "Июнь 2026", 520, 41, 13, 2, 22000, 2400, 24, 4.6),
  snap("d4", "2026-08-03T09:00:00.000Z", "Июль 2026", 500, 40, 12, 3, 23000, 2400, 29, 4.6),
  snap("d5", "2026-09-03T09:00:00.000Z", "Август 2026", 640, 57, 18, 4, 25000, 2500, 36, 4.7),
  snap("d6", "2026-10-03T09:00:00.000Z", "Сентябрь 2026", 710, 67, 22, 6, 26000, 2600, 44, 4.7),
];

export const DEMO_TARGET = { leadsPerMonth: 70, salesPerMonth: 25 };

/** История выполнения плана: растёт от нуля до сегодняшнего состояния чек-листа. */
export const DEMO_PROGRESS: ProgressPoint[] = (() => {
  const final = makeProgressPoint(DEMO_PLAN, DEMO_CHECKLIST, new Date(2026, 9, 5));
  const dates = ["2026-04-06", "2026-05-06", "2026-06-06", "2026-07-06", "2026-08-06", "2026-09-06", "2026-10-05"];
  const k = [0.05, 0.2, 0.38, 0.55, 0.72, 0.9, 1];
  return dates.map((date, i) => ({
    date,
    total: Math.round(final.total * k[i]),
    foundation: Math.round(final.foundation * Math.min(1, k[i] * 1.15)),
    traffic: Math.round(final.traffic * k[i]),
    retention: Math.round(final.retention * k[i]),
    done: Math.round(final.done * k[i]),
    steps: final.steps,
  }));
})();

export const DEMO_READINESS = computeReadiness({
  plan: DEMO_PLAN,
  checklist: DEMO_CHECKLIST,
  checklistAccess: true,
  vectorId: "sage",
  vectorAccess: true,
  snapshots: DEMO_SNAPSHOTS,
  metrikaConnected: true,
});
