// Отметки о выполнении пунктов плана. Как и список бизнесов (lib/account.ts),
// пока хранятся в localStorage браузера, а не в базе — см. README про перенос
// бизнесов на сервер. Ключ привязан к id бизнеса, чтобы прогресс разных
// бизнесов в одном аккаунте не смешивался.

import { GeneratedPlan, PlanEntry } from "./types";

export type ChecklistState = Record<string, boolean[]>; // moduleId -> шаги выполнены

function keyFor(businessId: string) {
  return `promoplan_checklist_${businessId}`;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // приватный режим и т.п. — для прототипа не критично
  }
}

function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // не критично
  }
}

export function getChecklist(businessId: string): ChecklistState {
  const raw = safeGet(keyFor(businessId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as ChecklistState) : {};
  } catch {
    return {};
  }
}

export function toggleStep(
  businessId: string,
  moduleId: string,
  stepIndex: number,
  stepsLength: number
): ChecklistState {
  const state = getChecklist(businessId);
  const arr = state[moduleId] ? [...state[moduleId]] : [];
  while (arr.length < stepsLength) arr.push(false);
  arr[stepIndex] = !arr[stepIndex];
  const next: ChecklistState = { ...state, [moduleId]: arr };
  safeSet(keyFor(businessId), JSON.stringify(next));
  return next;
}

export function clearChecklist(businessId: string) {
  safeRemove(keyFor(businessId));
}

export function moduleProgress(state: ChecklistState, moduleId: string, totalSteps: number) {
  const arr = state[moduleId] ?? [];
  const done = arr.filter(Boolean).length;
  return { done, total: totalSteps, pct: totalSteps ? Math.round((done / totalSteps) * 100) : 0 };
}

export function phaseProgress(state: ChecklistState, entries: PlanEntry[]) {
  let done = 0;
  let total = 0;
  for (const entry of entries) {
    const arr = state[entry.module.id] ?? [];
    total += entry.module.steps.length;
    done += arr.filter(Boolean).length;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function planProgress(state: ChecklistState, plan: GeneratedPlan) {
  return phaseProgress(state, [...plan.foundation, ...plan.traffic, ...plan.retention]);
}

/** Первые N невыполненных шагов среди модулей фазы — для подсказки "доделайте это". */
export function unfinishedSteps(
  state: ChecklistState,
  entries: PlanEntry[],
  limit = 3
): { moduleTitle: string; step: string }[] {
  const result: { moduleTitle: string; step: string }[] = [];
  for (const entry of entries) {
    const arr = state[entry.module.id] ?? [];
    entry.module.steps.forEach((step, i) => {
      if (result.length >= limit) return;
      if (!arr[i]) result.push({ moduleTitle: entry.module.title, step });
    });
    if (result.length >= limit) break;
  }
  return result;
}
