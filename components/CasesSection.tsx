"use client";

import { useRef } from "react";
import { CASES } from "@/lib/cases";

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

      <p className="mt-6 text-center text-[13px] text-white/50">
        Результаты получены нашей агентской командой на реальных проектах — сервис «Ключевое
        слово» превращает тот же опыт в план, который вы получаете сами, без найма агентства.
      </p>
    </div>
  );
}
