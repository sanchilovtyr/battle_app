"use client";

import { useRef } from "react";

const CASES = [
  {
    type: "Наш кейс",
    title: "Медицинский центр",
    problem: "Нужно было увеличить охват сообщества и приток новых подписчиков без раздувания рекламного бюджета.",
    metrics: [
      { v: "5000+", l: "охват контента" },
      { v: "577", l: "новых подписчиков" },
    ],
    channel: "Продвижение сообщества ВКонтакте",
  },
  {
    type: "Наш кейс",
    title: "Студия пилатеса",
    problem: "Нужно было не просто набрать подписчиков, а превратить их в реальные записи на тренировки.",
    metrics: [
      { v: "14 ₽", l: "стоимость подписчика" },
      { v: "+250%", l: "рост записей на тренировки" },
    ],
    channel: "Продвижение в социальных сетях",
  },
  {
    type: "Наш кейс",
    title: "Студия подкастов",
    problem: "Нужно было расти во ВКонтакте и получать не просто подписчиков, а заявки.",
    metrics: [
      { v: "200+", l: "заполненных заявок" },
      { v: "1039+", l: "переходов на сайт" },
    ],
    channel: "ВКонтакте",
  },
  {
    type: "Наш кейс",
    title: "Компания по продаже гранита",
    problem: "Нужны были не просто заявки с сайта, а квалифицированные обращения по разумной цене.",
    metrics: [
      { v: "+65%", l: "рост конверсии сайта" },
      { v: "1086 ₽", l: "стоимость заявки" },
    ],
    channel: "Реклама и заявки с сайта",
  },
  {
    type: "Наш кейс",
    title: "Мебельное производство",
    problem: "Нужно было вырасти сразу в двух каналах — ВКонтакте и Telegram.",
    metrics: [
      { v: "+120%", l: "рост аудитории в ВК и Telegram" },
      { v: "47 ₽", l: "стоимость нового подписчика" },
    ],
    channel: "ВКонтакте + Telegram",
  },
  {
    type: "Наш кейс",
    title: "Производитель бытовой химии",
    problem: "Нужно было привести трафик в карточку товара с низкой стоимостью перехода.",
    metrics: [
      { v: "44 825", l: "переходов в карточку товара" },
      { v: "6 ₽", l: "стоимость перехода" },
    ],
    channel: "Маркетплейс + ВКонтакте + Telegram",
  },
  {
    type: "Наш кейс",
    title: "Кафе",
    problem: "Нужно было привести новых гостей через соцсети и превратить подписчиков в реальные брони.",
    metrics: [
      { v: "+30%", l: "рост броней из соцсетей" },
      { v: "9 ₽", l: "стоимость подписчика" },
    ],
    channel: "Продвижение в социальных сетях",
  },
  {
    type: "Наш кейс",
    title: "Фитнес-клуб",
    problem: "Нужно было расти во ВКонтакте и получать заявки на абонементы по предсказуемой цене.",
    metrics: [
      { v: "859+", l: "заявок" },
      { v: "600 ₽", l: "стоимость заявки" },
    ],
    channel: "ВКонтакте",
  },
  {
    type: "Наш кейс",
    title: "Салон красоты",
    problem: "Нужно было увеличить число целевых подписчиков и получать больше конверсий с сайта.",
    metrics: [
      { v: "2500+", l: "конверсий" },
      { v: "300 ₽", l: "стоимость конверсии" },
    ],
    channel: "Реклама и продвижение в социальных сетях",
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
            className="flex min-h-[300px] w-full shrink-0 snap-start flex-col rounded-2xl border border-white/10 bg-white/5 p-6 sm:w-[45%] lg:w-[calc(33.333%-12px)]"
          >
            <span className="text-[13px] font-bold text-brand">{c.type}</span>
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
