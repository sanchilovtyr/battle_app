// Хранение клиентов CRM в localStorage + копия на сервере (lib/cloudSync.ts),
// как и у воронки (lib/funnel.ts).

import { markDirty } from "./cloudSync";
import { CrmClient, MAX_CLIENTS } from "./crmCore";

function keyFor(businessId: string) {
  return `promoplan_clients_${businessId}`;
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
    // не критично
  }
}

export function getClients(businessId: string): CrmClient[] {
  const raw = safeGet(keyFor(businessId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CrmClient[]) : [];
  } catch {
    return [];
  }
}

/** Сохранить весь список (новые сверху, не больше MAX_CLIENTS). */
export function saveClients(businessId: string, clients: CrmClient[]): CrmClient[] {
  const next = clients.slice(0, MAX_CLIENTS);
  safeSet(keyFor(businessId), JSON.stringify(next));
  markDirty(businessId, ["clients"]);
  return next;
}

export function clearClients(businessId: string) {
  try {
    window.localStorage.removeItem(keyFor(businessId));
  } catch {
    // не критично
  }
}

export function newClientId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
