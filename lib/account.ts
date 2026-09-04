// Список "бизнесов" пользователя пока живёт в localStorage браузера, в отличие
// от аккаунта, подписки и платежей — они уже переехали в базу данных (см.
// app/api/me, app/api/payments/*). Перенос бизнесов в БД — следующий шаг,
// см. README.

const EMAIL_KEY = "promoplan_email";
const PROFILE_KEY = "promoplan_profile";
const SUBSCRIPTION_KEY = "promoplan_subscription";
const BUSINESSES_KEY = "promoplan_businesses";

export interface Business {
  id: string;
  name: string;
  businessType: string;
  createdAt: string;
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
    // локальное хранилище недоступно (приватный режим и т.п.) — для прототипа не критично
  }
}

function safeRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // не критично
  }
}

/** Очищает локальные остатки старой (localStorage) версии аккаунта и список бизнесов.
 *  Вызывается при выходе и при удалении аккаунта. */
export function clearAccount() {
  safeRemove(EMAIL_KEY);
  safeRemove(PROFILE_KEY);
  safeRemove(SUBSCRIPTION_KEY);
  safeRemove(BUSINESSES_KEY);
}

export function getBusinesses(): Business[] {
  const raw = safeGet(BUSINESSES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Business[];
  } catch {
    return [];
  }
}

export function addBusiness(entry: Omit<Business, "id" | "createdAt">): Business {
  const business: Business = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  const next = [...getBusinesses(), business];
  safeSet(BUSINESSES_KEY, JSON.stringify(next));
  return business;
}

export function removeBusiness(id: string) {
  const next = getBusinesses().filter((b) => b.id !== id);
  safeSet(BUSINESSES_KEY, JSON.stringify(next));
}
