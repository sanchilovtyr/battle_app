/** Чистая логика гида по кабинету: кому показывать, какие шаги доступны. Тесты — scripts/tour_test.ts */

export const NEW_USER_DAYS = 14;

export interface TourStep {
  /** Значение атрибута data-tour у элемента, который подсвечиваем. Без target — карточка по центру. */
  target?: string;
  title: string;
  text: string;
}

/** Новый пользователь — аккаунт создан не больше NEW_USER_DAYS дней назад */
export function isNewUser(createdAtIso: string | null | undefined, now: number = Date.now()): boolean {
  if (!createdAtIso) return false;
  const t = Date.parse(createdAtIso);
  if (Number.isNaN(t)) return false;
  return now - t <= NEW_USER_DAYS * 86400000 && now >= t - 3600_000;
}

export function tourStorageKey(tourId: string, email: string): string {
  return `mn_tour_${tourId}_${email.trim().toLowerCase()}`;
}

/** Оставляет шаги, у которых есть что подсвечивать (или нет target — они по центру) */
export function availableSteps(steps: TourStep[], exists: (target: string) => boolean): TourStep[] {
  return steps.filter((s) => !s.target || exists(s.target));
}

export interface PlanFlags {
  audienceVectorAccess: boolean;
  checklistAccess: boolean;
  growthPointsAccess: boolean;
  risksAccess: boolean;
  unitEconomicsAccess: boolean;
  crmAccess: boolean;
}

const LOCK_BUSINESS = " Сейчас этот раздел закрыт: он открывается на тарифе «Бизнес» и выше.";
const LOCK_PREMIUM = " Сейчас этот раздел закрыт: он открывается на тарифе «Премиум».";

/** Шаги гида по плану. Для закрытых тарифом разделов честно говорим, что они закрыты и на каком тарифе открываются. */
export function planTourSteps(f: PlanFlags): TourStep[] {
  return [
    {
      title: "Это ваш план продвижения",
      text: "Здесь три этапа: подготовка, привлечение клиентов и удержание. В каждом — конкретные шаги. Делайте их по порядку и отмечайте выполненные: так видно, что уже сделано.",
    },
    {
      target: "plan-nav",
      title: "Разделы плана",
      text: "Всё, что связано с вашим бизнесом, собрано в этом меню. Сейчас коротко пройдёмся по каждому разделу.",
    },
    {
      target: "nav-vector",
      title: "Ваш вектор аудитории",
      text: "Кто ваш клиент и как с ним говорить: какие каналы и сообщения подойдут именно вам. Определяется один раз для бизнеса." + (f.audienceVectorAccess ? "" : LOCK_BUSINESS),
    },
    {
      target: "nav-dashboard",
      title: "Дашборд динамики",
      text: "Цифры по неделям и месяцам: обращения, заявки, продажи и то, окупается ли реклама (ROMI). Вносите показатели раз в неделю — график построится сам." + (f.checklistAccess ? "" : LOCK_BUSINESS),
    },
    {
      target: "nav-losses",
      title: "Где вы теряете клиентов",
      text: "Путь клиента от первого обращения до покупки и шаг, на котором уходит больше всего людей. Можно подключить Яндекс.Метрику, чтобы цифры подставлялись сами." + (f.checklistAccess ? "" : LOCK_BUSINESS),
    },
    {
      target: "nav-growth",
      title: "Точки роста компании",
      text: "Цель на месяц и самые выгодные места, где бизнес может вырасти быстрее всего." + (f.growthPointsAccess ? "" : LOCK_PREMIUM),
    },
    {
      target: "nav-risks",
      title: "Управление рисками",
      text: "Что может пойти не так — новые законы, снижение цен у конкурентов, сбои поставок — и что делать заранее. Раздел показывает свежие новости по вашей теме и изменения на сайтах конкурентов." + (f.risksAccess ? "" : LOCK_PREMIUM),
    },
    {
      target: "nav-unit-economics",
      title: "Юнит-экономика",
      text: "Сколько стоит привести одного клиента и сколько он приносит: стоимость клиента, прибыль с него, окупаемость. Ползунки покажут, что будет, если изменить цену или рекламный бюджет." + (f.unitEconomicsAccess ? "" : LOCK_PREMIUM),
    },
    {
      target: "nav-clients",
      title: "Клиенты (CRM)",
      text: "Простой список клиентов: статус, сумма сделки и откуда пришёл. Показывает, сколько выручки принёс сервис." + (f.crmAccess ? "" : LOCK_PREMIUM),
    },
    {
      title: "Готово",
      text: "Если возникнут вопросы, напишите нам в личном кабинете в разделе «Поддержка». Этот обзор можно открыть снова кнопкой «Подсказки».",
    },
  ];
}

export const ACCOUNT_TOUR_STEPS: TourStep[] = [
  {
    title: "Добро пожаловать в личный кабинет",
    text: "Покажем за минуту, что здесь есть. Подсказки можно пропустить и открыть снова кнопкой «Подсказки» вверху.",
  },
  {
    target: "account-profile",
    title: "Данные профиля",
    text: "Имя и телефон необязательны, но так нам проще связаться, если понадобится помощь.",
  },
  {
    target: "account-subscription",
    title: "Подписка",
    text: "Ваш тариф и срок действия. Здесь можно выбрать или сменить тариф, отказаться от автопродления и отвязать сохранённую карту.",
  },
  {
    target: "account-businesses",
    title: "Мои бизнесы",
    text: "Все ваши планы продвижения. Сколько бизнесов можно вести, зависит от тарифа. Новый план создаётся кнопкой внизу этого блока.",
  },
  {
    target: "account-open-plan",
    title: "Откройте план",
    text: "Начните отсюда: внутри план по шагам, дашборд, воронка и другие разделы.",
  },
  {
    target: "account-support",
    title: "Поддержка",
    text: "Есть вопрос или что-то не работает — напишите сюда, можно приложить картинку. Ответ придёт в этот же раздел.",
  },
  {
    title: "Это всё",
    text: "Приятной работы! Подсказки по разделам плана появятся, когда вы откроете свой план.",
  },
];
