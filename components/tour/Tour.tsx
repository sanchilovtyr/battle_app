"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { TourStep, availableSteps, isNewUser, tourStorageKey } from "@/lib/tourCore";

export const TOUR_EVENT = "mn-tour-start";

/** Запускает гид с любой кнопки: startTour("plan") */
export function startTour(id: string) {
  window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: id }));
}

// /api/me запрашиваем один раз на все гиды страницы
let meCache: Promise<{ createdAt?: string } | null> | null = null;
function loadMe() {
  if (!meCache) {
    meCache = fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return meCache;
}

function visibleTarget(name: string): HTMLElement | null {
  const list = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  for (const el of Array.from(list)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

interface Box { top: number; left: number; width: number; height: number }

/**
 * Гид с подсветкой элементов. Сам открывается один раз для нового пользователя (аккаунт не старше 14 дней),
 * остальным — по кнопке «Подсказки». ready=false откладывает запуск, пока страница не загрузилась.
 */
export default function Tour({ id, steps, ready }: { id: string; steps: TourStep[]; ready: boolean }) {
  const { data: session } = useSession();
  const email = session?.user?.email ?? null;
  const [active, setActive] = useState<TourStep[] | null>(null);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(180);
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const autoTried = useRef(false);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const markSeen = useCallback(() => {
    if (!email) return;
    try {
      localStorage.setItem(tourStorageKey(id, email), "1");
    } catch {
      /* хранилище недоступно */
    }
  }, [email, id]);

  const open = useCallback(() => {
    const list = availableSteps(stepsRef.current, (t) => !!visibleTarget(t));
    if (list.length) {
      setI(0);
      setActive(list);
    }
  }, []);

  const close = useCallback(() => {
    markSeen();
    setActive(null);
    setBox(null);
  }, [markSeen]);

  // Автозапуск для нового пользователя
  useEffect(() => {
    if (!ready || !email || autoTried.current) return;
    autoTried.current = true;
    let seen = false;
    try {
      seen = !!localStorage.getItem(tourStorageKey(id, email));
    } catch {
      seen = true;
    }
    if (seen) return;
    let cancelled = false;
    loadMe().then((me) => {
      if (cancelled || !isNewUser(me?.createdAt)) return;
      setTimeout(() => !cancelled && open(), 900);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, email, id, open]);

  // Запуск по кнопке
  useEffect(() => {
    const h = (e: Event) => {
      if ((e as CustomEvent).detail === id) open();
    };
    window.addEventListener(TOUR_EVENT, h);
    return () => window.removeEventListener(TOUR_EVENT, h);
  }, [id, open]);

  const step = active ? active[i] : null;

  const measure = useCallback(() => {
    if (!step?.target) {
      setBox(null);
      return;
    }
    const el = visibleTarget(step.target);
    if (!el) {
      setBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 8;
    setBox({ top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 });
  }, [step]);

  // Прокрутка к элементу и слежение за положением
  useEffect(() => {
    if (!step) return;
    const el = step.target ? visibleTarget(step.target) : null;
    if (el) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const r = el.getBoundingClientRect();
      const fits = r.top >= 90 && r.bottom <= window.innerHeight - 220;
      if (!fits) el.scrollIntoView({ block: r.height > window.innerHeight * 0.5 ? "start" : "center", inline: "center", behavior: reduce ? "auto" : "smooth" });
    }
    measure();
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    const t1 = setTimeout(measure, 300);
    const t2 = setTimeout(measure, 700);
    window.addEventListener("scroll", on, true);
    window.addEventListener("resize", on);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("scroll", on, true);
      window.removeEventListener("resize", on);
    };
  }, [step, measure]);

  useLayoutEffect(() => {
    if (card.current) setCardH(card.current.offsetHeight);
  }, [step, box]);

  useEffect(() => {
    if (!step) return;
    next.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" || e.key === "Enter") {
        if (document.activeElement === next.current) return; // Enter на кнопке сработает сам
        e.preventDefault();
        setI((n) => (active && n < active.length - 1 ? n + 1 : n));
      }
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [step, close, active]);

  if (!active || !step) return null;

  const last = i === active.length - 1;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const narrow = vw < 640;
  const W = Math.min(360, vw - 24);

  // Положение карточки: под элементом, иначе над ним, иначе по центру; на телефоне — снизу
  let style: React.CSSProperties;
  if (narrow) {
    style = { left: 12, right: 12, bottom: 12 };
  } else if (!box) {
    style = { left: (vw - W) / 2, top: Math.max(16, (vh - cardH) / 2), width: W };
  } else {
    const rightX = box.left + box.width + 16;
    if (box.width < 460 && rightX + W <= vw - 12) {
      // узкий элемент у левого края (меню) — карточка справа от него, не закрывая соседние пункты
      style = { top: Math.min(Math.max(12, box.top), Math.max(12, vh - cardH - 12)), left: rightX, width: W };
    } else {
      const below = box.top + box.height + 14;
      const above = box.top - cardH - 14;
      const top = below + cardH <= vh - 12 ? below : above >= 12 ? above : Math.max(12, vh - cardH - 12);
      style = { top, left: Math.min(Math.max(12, box.left), vw - W - 12), width: W };
    }
  }

  return (
    <div className="print:hidden fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Подсказки по кабинету">
      {/* Блокирует клики по странице, пока идёт гид */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} style={box ? undefined : { background: "rgba(15,15,30,0.6)" }} />
      {box && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-xl transition-all duration-300"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: "0 0 0 9999px rgba(15,15,30,0.6), 0 0 0 3px #7c5cff",
          }}
        />
      )}
      <div ref={card} className="absolute rounded-2xl border border-line bg-white p-5 shadow-2xl" style={style}>
        <p className="mb-1 text-xs text-muted">
          {i + 1} из {active.length}
        </p>
        <h2 className="mb-2 font-display text-lg text-ink-900">{step.title}</h2>
        <p className="mb-4 text-sm leading-relaxed text-muted">{step.text}</p>
        <div className="flex items-center justify-between gap-2">
          <button onClick={close} className="text-sm text-muted underline underline-offset-4 hover:text-ink-900">
            {last ? "Закрыть" : "Пропустить"}
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button onClick={() => setI(i - 1)} className="rounded-full border border-ink-900/20 px-4 py-2 text-sm font-medium text-ink-900 hover:bg-soft">
                Назад
              </button>
            )}
            <button
              ref={next}
              onClick={() => (last ? close() : setI(i + 1))}
              className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
            >
              {last ? "Готово" : "Далее"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
