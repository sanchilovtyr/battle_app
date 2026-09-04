export type PlanId = "trial" | "start" | "business" | "agency";

export interface PricingPlan {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  free?: boolean;
  /** Сколько разных бизнесов можно вести на этом тарифе */
  businessLimit: number;
  /** Виден ли этап 3 (удержание) в готовом плане */
  fullPlanAccess: boolean;
  /** Доступен ли мини-квиз "вектор аудитории" с рекомендациями по рекламе */
  audienceVectorAccess: boolean;
}

export const PLANS: PricingPlan[] = [
  {
    id: "trial",
    name: "Пробный",
    price: "0 ₽",
    period: "разово",
    description: "Чтобы попробовать сервис и увидеть, как выглядит ваш план",
    features: [
      "1 бизнес — один план (разово)",
      "Ограниченный доступ к шагам этого плана",
      "Без обновлений и сохранения истории",
    ],
    free: true,
    businessLimit: 1,
    fullPlanAccess: false,
    audienceVectorAccess: false,
  },
  {
    id: "start",
    name: "Старт",
    price: "1 990 ₽",
    period: "/мес",
    description: "Для одного бизнеса, чтобы получить первый чёткий план",
    features: [
      "1 бизнес в личном кабинете",
      "Персональный план продвижения",
      "Обновление плана раз в месяц",
      "Доступ ко всем модулям-инструкциям",
    ],
    businessLimit: 1,
    fullPlanAccess: true,
    audienceVectorAccess: false,
  },
  {
    id: "business",
    name: "Бизнес",
    price: "4 490 ₽",
    period: "/мес",
    description: "Для владельца, который ведёт продвижение сам и хочет контроль",
    features: [
      "До 3 бизнесов в одном аккаунте",
      "Всё из тарифа «Старт»",
      "Чек-листы с отметками о выполнении",
      "Определение вектора аудитории и рекомендации по рекламе",
      "Экспорт плана в PDF",
      "Обновление плана каждую неделю",
      "Техническая поддержка",
    ],
    highlighted: true,
    businessLimit: 3,
    fullPlanAccess: true,
    audienceVectorAccess: true,
  },
  {
    id: "agency",
    name: "Команда",
    price: "6 990 ₽",
    period: "/мес",
    description: "Для нескольких точек/филиалов или агентства на аутсорсе",
    features: [
      "До 5 бизнесов в одном аккаунте",
      "Всё из тарифа «Старт»",
      "Чек-листы с отметками о выполнении",
      "Определение вектора аудитории и рекомендации по рекламе",
      "Экспорт плана в PDF",
      "Обновление плана каждую неделю",
      "Техническая поддержка",
    ],
    businessLimit: 5,
    fullPlanAccess: true,
    audienceVectorAccess: true,
  },
];

export function getPlan(id: PlanId): PricingPlan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
