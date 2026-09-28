// Временное хранилище "гостевого" плана — на случай, если посетитель прошёл
// анкету без регистрации, а затем решил зарегистрироваться через Яндекс ID.
// Вход через OAuth уводит с сайта на oauth.yandex.ru и возвращает на новую
// загрузку страницы, поэтому react-состояние анкеты (ответы, план, название
// бизнеса) иначе бы терялось. Здесь оно переживает редирект, а заодно и
// случайное обновление страницы гостем до регистрации.
//
// Живёт только в localStorage текущего браузера, удаляется сразу после того,
// как план успешно сохранён в аккаунт (см. persistPlan в PlanBuilder).

import { GeneratedPlan } from "./types";

const KEY = "promoplan_pending_guest_plan";

export interface PendingGuestPlan {
  businessName: string;
  businessType: string;
  plan: GeneratedPlan;
}

export function savePendingGuestPlan(data: PendingGuestPlan) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // недоступно (приватный режим и т.п.) — тогда просто не переживёт редирект/обновление страницы
  }
}

export function loadPendingGuestPlan(): PendingGuestPlan | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingGuestPlan;
  } catch {
    return null;
  }
}

export function clearPendingGuestPlan() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // не критично
  }
}
