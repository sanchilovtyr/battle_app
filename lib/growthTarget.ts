// Собственная цель клиента по заявкам/продажам в месяц — в отличие от
// воронки (lib/funnel.ts), это не показатель за период, а редко меняющийся
// ориентир, с которым сравниваются фактические цифры в "Точках роста".
// Хранится в localStorage, как чек-лист и воронка.

export interface GrowthTarget {
  leadsPerMonth?: number;
  salesPerMonth?: number;
}

function keyFor(businessId: string) {
  return `promoplan_target_${businessId}`;
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

export function getGrowthTarget(businessId: string): GrowthTarget {
  const raw = safeGet(keyFor(businessId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as GrowthTarget) : {};
  } catch {
    return {};
  }
}

export function setGrowthTarget(businessId: string, target: GrowthTarget): GrowthTarget {
  const next: GrowthTarget = {
    leadsPerMonth: target.leadsPerMonth || undefined,
    salesPerMonth: target.salesPerMonth || undefined,
  };
  safeSet(keyFor(businessId), JSON.stringify(next));
  return next;
}
