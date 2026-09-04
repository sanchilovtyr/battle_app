export interface QuestionOption {
  value: string;
  label: string;
  hint?: string;
}

export interface Question {
  id: string;
  title: string;
  subtitle?: string;
  options: QuestionOption[];
}

export const QUESTIONS: Question[] = [
  {
    id: "businessType",
    title: "Чем занимается ваш бизнес?",
    subtitle: "Выберите вариант, который ближе всего",
    options: [
      { value: "retail", label: "Розничная торговля", hint: "магазин, точка продаж" },
      { value: "services", label: "Услуги", hint: "мастер, студия, сервис" },
      { value: "horeca", label: "Кафе, ресторан, HoReCa" },
      { value: "b2b", label: "B2B / услуги для бизнеса" },
      { value: "online_edu", label: "Онлайн-школа, курсы, инфопродукт" },
      { value: "ecommerce", label: "Интернет-магазин / e-commerce" },
      { value: "other", label: "Другое" },
    ],
  },
  {
    id: "hasSite",
    title: "У вас есть сайт или лендинг?",
    options: [
      { value: "true", label: "Да, есть" },
      { value: "false", label: "Нет, ещё не сделали" },
    ],
  },
  {
    id: "hasSocial",
    title: "Ведёте соцсети или Telegram-канал?",
    options: [
      { value: "true", label: "Да, ведём регулярно" },
      { value: "false", label: "Нет или заброшены" },
    ],
  },
  {
    id: "goal",
    title: "Какая цель сейчас важнее всего?",
    options: [
      { value: "leads", label: "Больше заявок и звонков" },
      { value: "sales_online", label: "Продажи прямо онлайн" },
      { value: "awareness", label: "Узнаваемость, о нас должны узнать" },
      { value: "repeat_sales", label: "Повторные покупки текущих клиентов" },
    ],
  },
  {
    id: "budget",
    title: "Какой бюджет на продвижение готовы выделять в месяц?",
    subtitle: "Без учёта затрат на подписку в этом сервисе",
    options: [
      { value: "under20", label: "До 20 000 ₽" },
      { value: "20to100", label: "20 000 – 100 000 ₽" },
      { value: "100to500", label: "100 000 – 500 000 ₽" },
      { value: "over500", label: "Более 500 000 ₽" },
    ],
  },
  {
    id: "geo",
    title: "Где находятся ваши клиенты?",
    options: [
      { value: "local", label: "Один город / район" },
      { value: "regional", label: "Регион / несколько городов" },
      { value: "national", label: "Вся Россия" },
    ],
  },
  {
    id: "experience",
    title: "Насколько вы опытны в интернет-продвижении?",
    options: [
      { value: "beginner", label: "Новичок, делаю первые шаги" },
      { value: "middle", label: "Средний уровень, что-то уже пробовал" },
      { value: "advanced", label: "Продвинутый, нужна точная приоритизация" },
    ],
  },
];
