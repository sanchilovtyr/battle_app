"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    n: "01",
    title: "Расскажите о бизнесе",
    text: "Сфера, город, бюджет — простыми словами, без брифов. Займёт около 2 минут.",
  },
  {
    n: "02",
    title: "Ответьте на вопросы",
    text: "Есть ли сайт и соцсети, какая цель и опыт в продвижении. Ещё минута.",
  },
  {
    n: "03",
    title: "Получите план",
    text: "Наш сервис соберёт маршрут из проверенных модулей под вас — за 30 секунд.",
  },
];

export default function JourneySection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [settled, setSettled] = useState(false);
  // На сенсорных экранах нет наведения: подсвечиваем карточку, которая сейчас в середине экрана
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setSettled(true), 900);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === "undefined" || !window.matchMedia("(hover: none)").matches) return;
    const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-step]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-42% 0px -42% 0px" }
    );
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative grid gap-3 md:grid-cols-[repeat(3,1fr)_1.15fr] md:items-stretch">
      <div className="absolute left-[9%] right-[9%] top-[39px] hidden border-t-2 border-dashed border-line md:block" />

      {STEPS.map((s, i) => (
        <article
          key={s.n}
          data-step={i}
          style={{ transitionDelay: visible && !settled ? `${i * 120}ms` : "0ms" }}
          className={`group relative z-10 rounded-2xl border bg-white p-5 pt-4.5 transition-all duration-300 ease-out motion-reduce:transition-none md:p-6 hover:-translate-y-1.5 hover:border-violet hover:shadow-[0_18px_40px_rgba(118,88,246,0.16)] ${
            active === i ? "!border-violet shadow-[0_18px_40px_rgba(118,88,246,0.16)]" : "border-line"
          } ${visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold transition-transform duration-300 group-hover:scale-110 ${
              active === i ? "scale-110" : ""
            } ${
              i === 0
                ? "bg-ink-900 text-brand"
                : i === 1
                ? "bg-violet text-white"
                : "bg-violet-soft text-violet"
            }`}
          >
            {s.n}
          </div>
          <h3 className="mb-1.5 mt-3.5 text-lg font-extrabold tracking-tight text-ink-900">{s.title}</h3>
          <p className="text-sm text-muted">{s.text}</p>
        </article>
      ))}

      <article
        data-step={STEPS.length}
        style={{ transitionDelay: visible && !settled ? `${STEPS.length * 120}ms` : "0ms" }}
        className={`relative z-10 flex min-h-[215px] flex-col rounded-2xl border border-ink-900 bg-ink-900 p-6 text-white transition-all duration-300 ease-out motion-reduce:transition-none hover:-translate-y-1.5 hover:border-brand hover:shadow-[0_18px_40px_rgba(17,21,37,0.35)] ${
          active === STEPS.length ? "!border-brand shadow-[0_18px_40px_rgba(17,21,37,0.35)]" : ""
        } ${visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
      >
        <div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-ink-900">
            ✓
          </div>
          <h3 className="my-3 text-xl font-extrabold leading-tight tracking-tight">
            Готовый маршрут привлечения клиентов
          </h3>
          <p className="text-[13px] text-white/60">
            Снимаем рутину планирования — вам остаётся выбрать и запустить первые шаги.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {[
            { v: "3–5", l: "каналов" },
            { v: "11", l: "модулей" },
            { v: "1", l: "план" },
          ].map((s) => (
            <span key={s.l} className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] text-white/80">
              <b className="block text-base text-brand">{s.v}</b>
              {s.l}
            </span>
          ))}
        </div>

        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">
            На тарифах выше — ещё глубже
          </p>
          <ul className="space-y-1.5">
            {[
              "Вектор аудитории и рекомендации по рекламе",
              "Точки роста бизнеса",
              "Аналитика: где теряете клиентов",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2 text-[12px] text-white/70">
                <span className="text-brand">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </article>
    </div>
  );
}
