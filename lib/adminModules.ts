import { MODULES } from "./modules";
import { Answers, BusinessType, Phase, PlanModule } from "./types";

const OVERRIDES_KEY = "promoplan_admin_overrides";
const CUSTOM_MODULES_KEY = "promoplan_admin_custom_modules";

/** Правки контента встроенных модулей: текст можно менять, формулу скоринга — нет */
export interface ModuleOverride {
  title: string;
  why: string;
  timeToResult: string;
  steps: string[];
}

/** Новый модуль, добавленный из админки. Скоринг здесь — простое правило,
 *  а не произвольная функция, чтобы его можно было безопасно задать формой */
export interface CustomModule {
  id: string;
  title: string;
  phase: Phase;
  timeToResult: string;
  why: string;
  steps: string[];
  score: number;
  /** Пусто — применяется ко всем типам бизнеса */
  businessTypes: BusinessType[];
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
    // не критично для прототипа
  }
}

export function getOverrides(): Record<string, ModuleOverride> {
  const raw = safeGet(OVERRIDES_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, ModuleOverride>;
  } catch {
    return {};
  }
}

export function saveOverride(moduleId: string, override: ModuleOverride) {
  const all = getOverrides();
  all[moduleId] = override;
  safeSet(OVERRIDES_KEY, JSON.stringify(all));
}

export function clearOverride(moduleId: string) {
  const all = getOverrides();
  delete all[moduleId];
  safeSet(OVERRIDES_KEY, JSON.stringify(all));
}

export function getCustomModules(): CustomModule[] {
  const raw = safeGet(CUSTOM_MODULES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CustomModule[];
  } catch {
    return [];
  }
}

export function saveCustomModule(module: CustomModule) {
  const all = getCustomModules();
  const idx = all.findIndex((m) => m.id === module.id);
  if (idx >= 0) {
    all[idx] = module;
  } else {
    all.push(module);
  }
  safeSet(CUSTOM_MODULES_KEY, JSON.stringify(all));
}

export function deleteCustomModule(id: string) {
  const next = getCustomModules().filter((m) => m.id !== id);
  safeSet(CUSTOM_MODULES_KEY, JSON.stringify(next));
}

/** Базовые модули с применёнными правками из админки (только для чтения текста —
 *  формула score у встроенных модулей всегда остаётся из кода, её через форму не задать) */
export function getEditableBaseModules(): (PlanModule & { isOverridden: boolean })[] {
  const overrides = getOverrides();
  return MODULES.map((m) => {
    const o = overrides[m.id];
    if (!o) return { ...m, isOverridden: false };
    return {
      ...m,
      title: o.title,
      timeToResult: o.timeToResult,
      steps: o.steps,
      why: () => o.why,
      isOverridden: true,
    };
  });
}

function customModuleToPlanModule(c: CustomModule): PlanModule {
  return {
    id: c.id,
    title: c.title,
    phase: c.phase,
    minBudget: "under20",
    timeToResult: c.timeToResult,
    why: () => c.why,
    steps: c.steps,
    score: (a: Answers) =>
      c.businessTypes.length === 0 || c.businessTypes.includes(a.businessType) ? c.score : 0,
  };
}

/** Полный список модулей, которым в итоге пользуется движок правил:
 *  встроенные (с учётом правок из админки) + добавленные из админки */
export function getEffectiveModules(): PlanModule[] {
  const base = getEditableBaseModules().map(({ isOverridden, ...m }) => m);
  const custom = getCustomModules().map(customModuleToPlanModule);
  return [...base, ...custom];
}
