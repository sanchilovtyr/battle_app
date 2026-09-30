// Самостоятельно вносимые пользователем показатели воронки продаж. Сервис не
// подключён к счётчикам, телефонии или CRM бизнеса — только к тому, что
// пользователь укажет сам. Хранится в localStorage, как и бизнесы
// (lib/account.ts) и чек-листы (lib/checklist.ts).

export type FunnelChannel =
  | "yandex_direct"
  | "vk_ads"
  | "maps_reviews"
  | "referral"
  | "social_organic"
  | "offline"
  | "other";

export const FUNNEL_CHANNEL_LABELS: Record<FunnelChannel, string> = {
  yandex_direct: "Яндекс Директ",
  vk_ads: "Реклама VK",
  maps_reviews: "Карты / отзывы",
  referral: "Сарафан / рекомендации",
  social_organic: "Соцсети / Telegram (без рекламы)",
  offline: "Офлайн (вывеска, листовки, точка)",
  other: "Другое",
};

export type ResponseSpeed = "under_1h" | "same_day" | "slower";

export const RESPONSE_SPEED_LABELS: Record<ResponseSpeed, string> = {
  under_1h: "В течение часа",
  same_day: "В течение дня",
  slower: "Дольше суток",
};

export type DropReason = "price" | "no_answer" | "competitor" | "changed_mind" | "unknown";

export const DROP_REASON_LABELS: Record<DropReason, string> = {
  price: "Дорого / не устроила цена",
  no_answer: "Долго не отвечали на заявку",
  competitor: "Выбрали конкурента",
  changed_mind: "Просто передумали",
  unknown: "Не знаю / не уточняли",
};

export interface FunnelSnapshot {
  id: string;
  createdAt: string;
  label: string; // например "Сентябрь 2026" — вводит пользователь
  visitors: number; // обращения: визиты на сайт, звонки, сообщения
  leads: number; // заявки: оставили контакт
  sales: number; // продажи: оплатили в первый раз
  repeat: number; // повторные покупки за тот же период

  // Необязательные показатели для более точных "точек роста" — можно
  // заполнять не все и не каждый период.
  avgReceipt?: number; // средний чек, ₽
  adSpend?: number; // рекламный бюджет за период, ₽
  channel?: FunnelChannel; // основной канал, который принёс большинство обращений
  responseSpeed?: ResponseSpeed; // как быстро в среднем отвечали на заявки
  dropReason?: DropReason; // основная причина, по которой клиенты не доходили до оплаты
  reviewsCount?: number; // текущее число отзывов на Картах/2ГИС
  reviewsRating?: number; // текущий рейтинг на Картах/2ГИС (0–5)
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

/** Сколько подряд идущих календарных месяцев внесены показатели, считая от
 *  самого свежего периода назад. Используется для "стрика" — того же
 *  психологического приёма, что стрики в Дуолинго, только на уже
 *  существующих данных, без нового ввода от пользователя. */
export function streakMonths(snapshots: FunnelSnapshot[]): number {
  if (snapshots.length === 0) return 0;
  const months = snapshots.map((s) => {
    const d = new Date(s.createdAt);
    return d.getFullYear() * 12 + d.getMonth();
  });
  let streak = 1;
  for (let i = months.length - 1; i > 0; i--) {
    if (months[i] - months[i - 1] === 1) {
      streak += 1;
    } else if (months[i] - months[i - 1] === 0) {
      continue; // несколько записей в одном месяце не разрывают и не удлиняют стрик
    } else {
      break;
    }
  }
  return streak;
}
