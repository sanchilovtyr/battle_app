// Самостоятельно вносимые пользователем показатели воронки продаж. Сервис не
// подключён к счётчикам, телефонии или CRM бизнеса — только к тому, что
// пользователь укажет сам. Хранится в localStorage, как и бизнесы
// (lib/account.ts) и чек-листы (lib/checklist.ts).

export interface FunnelSnapshot {
  id: string;
  createdAt: string;
  label: string; // например "Сентябрь 2026" — вводит пользователь
  visitors: number; // обращения: визиты на сайт, звонки, сообщения
  leads: number; // заявки: оставили контакт
  sales: number; // продажи: оплатили в первый раз
  repeat: number; // повторные покупки за тот же период
}

function keyFor(businessId: string) {
  return `promoplan_funnel_${businessId}`;
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

function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // не критично
  }
}

export function getSnapshots(businessId: string): FunnelSnapshot[] {
  const raw = safeGet(keyFor(businessId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FunnelSnapshot[]) : [];
  } catch {
    return [];
  }
}

export function addSnapshot(
  businessId: string,
  data: Omit<FunnelSnapshot, "id" | "createdAt">
): FunnelSnapshot[] {
  const snapshot: FunnelSnapshot = {
    ...data,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const next = [...getSnapshots(businessId), snapshot].slice(-12); // храним последние 12 периодов
  safeSet(keyFor(businessId), JSON.stringify(next));
  return next;
}

export function removeSnapshot(businessId: string, id: string): FunnelSnapshot[] {
  const next = getSnapshots(businessId).filter((s) => s.id !== id);
  safeSet(keyFor(businessId), JSON.stringify(next));
  return next;
}

export function clearFunnel(businessId: string) {
  safeRemove(keyFor(businessId));
}

export function latestSnapshot(businessId: string): FunnelSnapshot | null {
  const list = getSnapshots(businessId);
  return list.length ? list[list.length - 1] : null;
}
