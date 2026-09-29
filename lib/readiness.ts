// "Индекс готовности маркетинга" — одна понятная цифра прогресса вместо
// нескольких разрозненных блоков (чек-лист, вектор, Метрика, воронка).
// Считается на клиенте из того, что уже загружено на странице плана —
// подключение к Метрике подтягивается отдельно компонентом ReadinessScore.

import { ChecklistState, planProgress } from "./checklist";
import { GeneratedPlan } from "./types";
import { FunnelSnapshot } from "./funnel";
import { VectorId } from "./vectors";

export interface ReadinessInput {
  plan: GeneratedPlan;
  checklist: ChecklistState;
  checklistAccess: boolean;
  vectorId?: VectorId | null;
  snapshots: FunnelSnapshot[];
  metrikaConnected: boolean;
}

export interface ReadinessItem {
  label: string;
  done: boolean;
}

export interface ReadinessResult {
  pct: number;
  items: ReadinessItem[];
  level: string;
}

const LEVELS: { min: number; label: string }[] = [
  { min: 100, label: "Мастер продвижения" },
  { min: 75, label: "Профи" },
  { min: 50, label: "Уверенный" },
  { min: 25, label: "На старте" },
  { min: 0, label: "Новичок" },
];

/** Название уровня по проценту готовности — чтобы цифра ощущалась как игровой прогресс, а не сухая метрика. */
export function readinessLevel(pct: number): string {
  return (LEVELS.find((l) => pct >= l.min) ?? LEVELS[LEVELS.length - 1]).label;
}

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const items: ReadinessItem[] = [{ label: "Вектор аудитории определён", done: Boolean(input.vectorId) }];

  if (input.checklistAccess) {
    const progress = planProgress(input.checklist, input.plan);
    items.push({
      label: "Чек-лист плана выполнен хотя бы наполовину",
      done: progress.total > 0 && progress.pct >= 50,
    });
    items.push({ label: "Подключена Яндекс.Метрика", done: input.metrikaConnected });
    items.push({ label: "Внесены показатели воронки хотя бы за один период", done: input.snapshots.length > 0 });
  } else {
    items.push({ label: "План построен и готов к работе", done: true });
    items.push({
      label: "Чек-листы, аналитика и Метрика — на тарифах «Бизнес» и «Команда»",
      done: false,
    });
  }

  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / items.length) * 100);
  return { pct, items, level: readinessLevel(pct) };
}
