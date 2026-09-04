"use client";

import { useRef } from "react";

const CASES = [
  {
    type: "Наш кейс",
    city: "Казань",
    title: "Студия маникюра",
    problem: "Нужно было заполнить расписание мастеров без скидок «для всех».",
    metrics: [
      { v: "+38%", l: "записей за месяц" },
      { v: "17", l: "дней до результата" },
    ],
    channel: "Яндекс Карты + поиск",
  },
  {
    type: "Наш кейс",
    city: "Екатеринбург",
    title: "Мебель на заказ",
    problem: "Нужны были целевые заявки на кухни, а не просмотры каталога.",
    metrics: [
      { v: "×2,1", l: "больше заявок" },
      { v: "−29%", l: "стоимость заявки" },
    ],
    channel: "Директ + ретаргетинг",
  },
  {
    type: "Наш кейс",
    city: "Санкт-Петербург",
    title: "Онлайн-школа",
    problem: "Нужно было проверить спрос на новый курс до большого запуска.",
    metrics: [
      { v: "146", l: "заявок за тест" },
      { v: "312 ₽", l: "стоимость заявки" },
    ],
    channel: "VK Реклама + Telegram",
  },
  {
    type: "Наш кейс",
    city: "Новосибирск",
    title: "Кофейня у метро",
    problem: "Нужно было увеличить поток гостей в будни в первой половине дня.",
    metrics: [
      { v: "+52%", l: "гостей с карт" },
      { v: "12", l: "дней до первых отзывов" },
    ],
    channel: "Карты + отзывы",
  },
  {
    type: "Наш кейс",
    city: "Москва",
    title: "IT-аутсорс для бизнеса",
    problem: "Нужны были предсказуемые лиды на аутсорс поддержки без холодных звонков.",
    metrics: [
      { v: "24", l: "лида за квартал" },
      { v: "890 ₽", l: "стоимость лида" },
    ],
    channel: "Telegram + контент-маркетинг",
  },
  {
    type: "Наш кейс",
    city: "Краснодар",
    title: "Интернет-магазин украшений",
    problem: "Клиенты покупали один раз и не возвращались за повторной покупкой.",
    metrics: [
      { v: "×1,8", l: "повторных покупок" },
      { v: "−18%", l: "отток клиентов" },
    ],
    channel: "CRM-рассылки + маркетплейсы",
  },
];

export default function CasesSection() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  };

  return (
    <div>
      <div className="mb-5 flex justify-end gap-2">
        <button
          onClick={() => scroll(-1)}
          aria-label="Предыдущие кейсы"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/10"
        >
          ‹
        </button>
        <button
          onClick={() => scroll(1)}
          aria-label="Следующие кейсы"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/10"
        >
          ›
        </button>
      </div>

      <div
        ref={trackRef}
        className="scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-5 pb-2 md:mx-0 md:px-0"
      >
        {CASES.map((c) => (
          <article
            key={c.title}
            className="flex min-h-[300px] w-[85%] shrink-0 snap-start flex-col rounded-2xl border border-white/10 bg-white/5 p-6 sm:w-[45%] lg:w-[calc(33.333%-12px)]"
          >
            <div className="flex items-center justify-between gap-2.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-brand">
                {c.type}
              </span>
              <span className="text-xs text-white/50">{c.city}</span>
            </div>
            <h3 className="mb-1.5 mt-4 text-xl font-extrabold tracking-tight">{c.title}</h3>
            <p className="mb-5 text-[13px] text-white/60">{c.problem}</p>
            <div className="mt-auto grid grid-cols-2 gap-2">
              {c.metrics.map((m) => (
                <div key={m.l} className="rounded-lg bg-white/10 p-2.5">
                  <b className="block text-xl tracking-tight text-brand">{m.v}</b>
                  <span className="text-[11px] text-white/60">{m.l}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-white/60">
              <b className="text-white">Сработало:</b> {c.channel}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
