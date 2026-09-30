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

  return (
    <div ref={containerRef} className="relative grid gap-3 md:grid-cols-[repeat(3,1fr)_1.15fr] md:items-stretch">
      <div className="absolute left-[9%] right-[9%] top-[39px] hidden border-t-2 border-dashed border-line md:block" />

      {STEPS.map((s, i) => (
        <article
          key={s.n}
          style={{ transitionDelay: visible ? `${i * 120}ms` : "0ms" }}
          className={`relative z-10 rounded-2xl border border-line bg-white p-5 pt-4.5 transition-all duration-500 ease-out motion-reduce:transition-none md:p-6 ${
            visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
          }`}
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-extrabold ${
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
        style={{ transitionDelay: visible ? `${STEPS.length * 120}ms` : "0ms" }}
        className={`relative z-10 flex min-h-[215px] flex-col justify-between rounded-2xl border border-ink-900 bg-ink-900 p-6 text-white transition-all duration-500 ease-out motion-reduce:transition-none ${
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
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
      </article>
    </div>
  );
}
