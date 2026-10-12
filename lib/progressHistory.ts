// История выполнения плана по дням — нужна дашборду, чтобы показывать динамику.
// Сами отметки чек-листа (lib/checklist.ts) хранят только текущее состояние,
// поэтому при каждом изменении отметок и при заходе на страницу бизнеса мы
// сохраняем «снимок» прогресса за день. История у тех, кто пользовался сервисом
// раньше, начинается с первого захода после этого обновления.
// Как и чек-лист и воронка, хранится в localStorage.

import type { GeneratedPlan } from "./types";
import { phaseProgress, planProgress, type ChecklistState } from "./checklist";
import { markDirty } from "./cloudSync";

export interface ProgressPoint {
  date: string; // YYYY-MM-DD, локальная дата пользователя
  total: number; // % выполнения всего плана
  foundation: number;
  traffic: number;
  retention: number;
  done: number; // выполнено шагов
  steps: number; // всего шагов
}

const MAX_POINTS = 180;

function keyFor(businessId: string) {
  return `promoplan_progress_${businessId}`;
}

export function localDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Чистая функция: посчитать точку прогресса по плану и чек-листу. */
export function makeProgressPoint(plan: GeneratedPlan, checklist: ChecklistState, now: Date): ProgressPoint {
  const all = planProgress(checklist, plan);
  return {
    date: localDate(now),
    total: all.pct,
    foundation: phaseProgress(checklist, plan.foundation).pct,
    traffic: phaseProgress(checklist, plan.traffic).pct,
    retention: phaseProgress(checklist, plan.retention).pct,
    done: all.done,
    steps: all.total,
  };
}

/** Чистая функция: добавить точку; запись за тот же день заменяется. */
export function upsertPoint(history: ProgressPoint[], point: ProgressPoint): ProgressPoint[] {
  const rest = history.filter((p) => p.date !== point.date);
  return [...rest, point].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_POINTS);
}

export function getProgressHistory(businessId: string): ProgressPoint[] {
  try {
    const raw = window.localStorage.getItem(keyFor(businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ProgressPoint[]) : [];
  } catch {
    return [];
  }
}

export function recordProgress(
  businessId: string,
  plan: GeneratedPlan,
  checklist: ChecklistState,
  now: Date = new Date()
): ProgressPoint[] {
  const prev = getProgressHistory(businessId);
  const point = makeProgressPoint(plan, checklist, now);
  const same = prev.find((p) => p.date === point.date);
  // ничего не изменилось за сегодня — не пишем и не отправляем на сервер
  if (same && JSON.stringify(same) === JSON.stringify(point)) return prev;
  const next = upsertPoint(prev, point);
  markDirty(businessId, ["progress"]);
  try {
    window.localStorage.setItem(keyFor(businessId), JSON.stringify(next));
  } catch {
    // не критично
  }
  return next;
}

export function clearProgressHistory(businessId: string) {
  try {
    window.localStorage.removeItem(keyFor(businessId));
  } catch {
    // не критично
  }
}
