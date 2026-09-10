import { GeneratedPlan } from "./types";

const MAX_MODULES_PER_PHASE = 10;
const MAX_STEPS_PER_MODULE = 20;
const MAX_STRING_LENGTH = 2000;

/** Грубая, но достаточная проверка, что план не аномально большой —
 *  не даём чужому JSON заставить сервер генерировать гигантский PDF */
export function isPlanSizeReasonable(plan: GeneratedPlan): boolean {
  const phases = [plan.foundation, plan.traffic, plan.retention];

  if (typeof plan.summary !== "string" || plan.summary.length > MAX_STRING_LENGTH) return false;

  for (const entries of phases) {
    if (!Array.isArray(entries) || entries.length > MAX_MODULES_PER_PHASE) return false;

    for (const entry of entries) {
      if (typeof entry?.reason !== "string" || entry.reason.length > MAX_STRING_LENGTH) return false;
      if (typeof entry?.module?.title !== "string" || entry.module.title.length > 300) return false;
      if (!Array.isArray(entry?.module?.steps) || entry.module.steps.length > MAX_STEPS_PER_MODULE) {
        return false;
      }
      for (const step of entry.module.steps) {
        if (typeof step !== "string" || step.length > MAX_STRING_LENGTH) return false;
      }
    }
  }

  return true;
}
