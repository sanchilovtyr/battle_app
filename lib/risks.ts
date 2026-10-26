// Реестр рисков в localStorage + копия на сервере (lib/cloudSync.ts),
// как у воронки (lib/funnel.ts) и CRM (lib/crm.ts).

import { markDirty } from "./cloudSync";
import { MAX_RISKS, Risk } from "./risksCore";

function keyFor(businessId: string) {
  return `promoplan_risks_${businessId}`;
}

export function getRisks(businessId: string): Risk[] {
  try {
    const raw = window.localStorage.getItem(keyFor(businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Risk[]) : [];
  } catch {
    return [];
  }
}

export function saveRisks(businessId: string, risks: Risk[]): Risk[] {
  const next = risks.slice(0, MAX_RISKS);
  try {
    window.localStorage.setItem(keyFor(businessId), JSON.stringify(next));
  } catch {
    // не критично
  }
  markDirty(businessId, ["risks"]);
  return next;
}

export function clearRisks(businessId: string) {
  try {
    window.localStorage.removeItem(keyFor(businessId));
  } catch {
    // не критично
  }
}
