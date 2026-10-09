"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CASES, type CaseStudy } from "@/lib/cases";
import { NICHES, nichePath } from "@/lib/niches";

export default function CasesSection() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<CaseStudy | null>(null);

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
        className="scrollbar-hide -mx-5 flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-2 sm:gap-4 sm:px-5 md:mx-0 md:px-0"
      >
        {CASES.map((c) => (
          <div
            key={c.title}
            className="w-full shrink-0 snap-start px-5 sm:w-[45%] sm:px-0 lg:w-[calc(33.333%-12px)]"
          >
            <article
              role="button"
              tabIndex={0}
              onClick={() => setOpen(c)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(c);
                }
              }}
              aria-label={`Открыть кейс: ${c.title}`}
              className="group flex min-h-[300px] cursor-pointer flex-col rounded-2xl border border-white/10 bg-white/5 p-6 transition-colors duration-200 hover:border-brand/60 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
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
              <p className="mt-4 flex items-center justify-between gap-2 text-xs text-white/60">
                <span>
                  <b className="text-white">Сработало:</b> {c.channel}
                </span>
                <span className="shrink-0 font-semibold text-brand opacity-70 transition-opacity group-hover:opacity-100" aria-hidden>
                  Подробнее ↗
                </span>
              </p>
            </article>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-[13px] text-white/50">
        Результаты получены нашей агентской командой на реальных проектах — сервис «Ключевое
        слово» превращает тот же опыт в план, который вы получаете сами, без найма агентства.
      </p>
      {open && <CaseModal c={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CaseModal({ c, onClose }: { c: CaseStudy; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const niche = NICHES.find((n) => n.caseTitles.includes(c.title));

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Кейс: ${c.title}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-ink-900 p-6 text-white shadow-2xl sm:p-10"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-lg text-white hover:bg-white/10"
        >
          ×
        </button>
        <span className="text-sm font-bold text-brand">{c.type}</span>
        <h3 className="mb-3 mt-3 pr-10 font-display text-2xl tracking-tight sm:text-3xl">{c.title}</h3>
        <p className="mb-7 text-base leading-relaxed text-white/70">{c.problem}</p>
        <div className="mb-7 grid gap-3 sm:grid-cols-2">
          {c.metrics.map((m) => (
            <div key={m.l} className="rounded-2xl bg-white/10 p-5">
              <b className="block font-display text-4xl tracking-tight text-brand">{m.v}</b>
              <span className="mt-1 block text-sm text-white/65">{m.l}</span>
            </div>
          ))}
        </div>
        <p className="mb-5 text-sm text-white/70">
          <b className="text-white">Сработало:</b> {c.channel}
        </p>
        {c.steps && c.steps.length > 0 && (
          <div className="mb-6">
            <b className="mb-2 block text-sm text-white">Что сделали</b>
            <ol className="space-y-1.5">
              {c.steps.map((st, i) => (
                <li key={st} className="flex gap-3 text-sm text-white/70">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-ink-900">{i + 1}</span>
                  <span>{st}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <p className="mb-7 rounded-xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-white/55">
          Результат получен нашей агентской командой до запуска сервиса «Ключевое слово». Это не результат сервиса и не гарантия такого же итога в другом бизнесе.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="#wizard" onClick={onClose} className="rounded-full bg-brand px-6 py-3 text-sm font-extrabold text-ink-900 transition-transform hover:-translate-y-0.5">
            Построить свой план
          </a>
          {niche && (
            <Link href={nichePath(niche.slug)} className="rounded-full border border-white/25 px-6 py-3 text-sm font-medium text-white hover:bg-white/10">
              План для ниши: {niche.name}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
