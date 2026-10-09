// Единый источник подписей для значений вопроса "Чем занимается ваш бизнес?"
// (см. lib/questions.ts, id: "businessType"). Раньше эти подписи дублировались
// в PlanBuilder — вынесены сюда, чтобы их же использовать для подбора кейса
// под нишу пользователя (см. lib/cases.ts).

export const BUSINESS_TYPE_LABELS: Record<string, string> = {
  retail: "Розничная торговля",
  services: "Услуги",
  horeca: "Кафе, ресторан",
  b2b: "B2B",
  online_edu: "Онлайн-школа",
  ecommerce: "Интернет-магазин",
  other: "Другое",
};

/** Обратный поиск: по сохранённой подписи (business.businessType) находит
 *  исходный ключ анкеты — нужен там, где известна только подпись, а не сам
 *  ответ пользователя (например, на странице уже сохранённого бизнеса). */
export function businessTypeKeyFromLabel(label?: string | null): string | undefined {
  if (!label) return undefined;
  const entry = Object.entries(BUSINESS_TYPE_LABELS).find(([, value]) => value === label);
  return entry?.[0];
}
