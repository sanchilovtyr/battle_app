// Допущения юнит-экономики (маржа, число покупок на клиента) — в localStorage
// и на сервере (lib/cloudSync.ts), как воронка и CRM.

import { markDirty } from "./cloudSync";
import type { UnitSettings } from "./unitEconomicsCore";

function keyFor(businessId: string) {
  return `promoplan_unit_${businessId}`;
}

export function getUnitSettings(businessId: string): UnitSettings {
  try {
    const raw = window.localStorage.getItem(keyFor(businessId));
    if (!raw) return {};
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as UnitSettings) : {};
  } catch {
    return {};
  }
}

export function saveUnitSettings(businessId: string, s: UnitSettings): UnitSettings {
  const next: UnitSettings = {
    ...(s.marginPct !== undefined ? { marginPct: s.marginPct } : {}),
    ...(s.purchases !== undefined ? { purchases: s.purchases } : {}),
  };
  try {
    window.localStorage.setItem(keyFor(businessId), JSON.stringify(next));
  } catch {
    // не критично
  }
  markDirty(businessId, ["unit"]);
  return next;
}

export function clearUnitSettings(businessId: string) {
  try {
    window.localStorage.removeItem(keyFor(businessId));
  } catch {
    // не критично
  }
}
