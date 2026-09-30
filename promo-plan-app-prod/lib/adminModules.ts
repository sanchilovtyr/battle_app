import { MODULES } from "./modules";
import { Answers, BusinessType, Phase, PlanModule } from "./types";

/** Правки контента встроенных модулей: текст можно менять, формулу скоринга — нет */
export interface ModuleOverride {
  title: string;
  why: string;
  timeToResult: string;
  steps: string[];
}

/** Новый модуль, добавленный из админки. Скоринг здесь — простое правило,
 *  а не произвольная функция, чтобы его можно было безопасно задать формой */
export interface CustomModuleData {
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

/** Базовые модули с применёнными правками (только текст — формула score
 *  у встроенных модулей всегда остаётся из кода, её через форму не задать) */
export function getEditableBaseModules(
  overrides: Record<string, ModuleOverride>
): (PlanModule & { isOverridden: boolean })[] {
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

function customModuleToPlanModule(c: CustomModuleData): PlanModule {
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
 *  встроенные (с учётом правок) + добавленные из админки */
export function buildEffectiveModules(
  overrides: Record<string, ModuleOverride>,
  customModules: CustomModuleData[]
): PlanModule[] {
  const base = getEditableBaseModules(overrides).map(({ isOverridden, ...m }) => m);
  const custom = customModules.map(customModuleToPlanModule);
  return [...base, ...custom];
}
