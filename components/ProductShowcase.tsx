"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BusinessDashboard from "@/components/dashboard/BusinessDashboard";
import FunnelDemo from "@/components/demo/FunnelDemo";
import AccountDemo from "@/components/demo/AccountDemo";
import PlanDemo from "@/components/demo/PlanDemo";
import { DEMO_BUSINESS, DEMO_PROGRESS, DEMO_SNAPSHOTS, DEMO_TARGET } from "@/lib/demoData";

function Dashboard() {
  return (
    <BusinessDashboard
      demo
      businessId={DEMO_BUSINESS.id}
      businessName={DEMO_BUSINESS.name}
      snapshots={DEMO_SNAPSHOTS}
      progress={DEMO_PROGRESS}
      target={DEMO_TARGET}
    />
  );
}

interface Example {
  id: string;
  title: string;
  text: string;
  /** Ширина, на которой интерфейс рисуется в карточке (затем уменьшается), и сдвиг вниз. */
  width: number;
  offsetY: number;
  preview: () => JSX.Element;
  full: () => JSX.Element;
}

const EXAMPLES: Example[] = [
  {
    id: "dashboard",
    title: "Дашборд динамики",
    text: "Заявки, продажи, конверсии и стоимость заявки: что растёт, а что стоит на месте.",
    width: 1000,
    offsetY: 110,
    preview: Dashboard,
    full: Dashboard,
  },
  {
    id: "charts",
    title: "Графики по периодам",
    text: "Цель на месяц, стоимость заявки, отзывы и выполнение плана по этапам.",
    width: 1000,
    offsetY: 800,
    preview: Dashboard,
    full: Dashboard,
  },
  {
    id: "funnel",
    title: "Где вы теряете клиентов",
    text: "Воронка по вашим цифрам и подсказка, какой этап плана исправит слабое место.",
    width: 720,
    offsetY: 0,
    preview: FunnelDemo,
    full: FunnelDemo,
  },
  {
    id: "plan",
    title: "План с чек-листом",
    text: "Три этапа, шаги под вашу нишу и бюджет, отметки о выполнении.",
    width: 720,
    offsetY: 0,
    preview: () => <PlanDemo />,
    full: () => <PlanDemo interactive />,
  },
  {
    id: "account",
    title: "Личный кабинет",
    text: "Ваши бизнесы, тариф и индекс готовности. Данные доступны при входе с любого устройства.",
    width: 720,
    offsetY: 0,
    preview: AccountDemo,
    full: AccountDemo,
  },
];

const PREVIEW_H = 300;

function ScaledPreview({ ex }: { ex: Example }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / ex.width));
    ro.observe(el);
    // рисуем интерфейс, только когда карточка приближается к экрану
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, [ex.width]);

  const Preview = ex.preview;
  return (
    <div ref={ref} className="relative overflow-hidden bg-white" style={{ height: PREVIEW_H }} aria-hidden>
      {visible && (
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left select-none bg-white p-6"
          style={{ width: ex.width, transform: `scale(${scale}) translateY(-${ex.offsetY}px)` }}
          // @ts-expect-error inert не описан в типах React 18, но поддерживается браузерами
          inert=""
        >
          <Preview />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}

export default function ProductShowcase() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  const close = useCallback(() => setOpenIdx(null), []);

  return (
    <div>
      <div className="mb-5 flex justify-end gap-2">
        <button
          onClick={() => scroll(-1)}
          aria-label="Предыдущие примеры"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-900/20 text-ink-900 transition-colors hover:bg-ink-900 hover:text-white"
        >
          ‹
        </button>
        <button
          onClick={() => scroll(1)}
          aria-label="Следующие примеры"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-900/20 text-ink-900 transition-colors hover:bg-ink-900 hover:text-white"
        >
          ›
        </button>
      </div>

      <div
        ref={trackRef}
        className="scrollbar-hide -mx-5 flex snap-x snap-mandatory scroll-pl-5 overflow-x-auto scroll-smooth px-5 pb-4 md:mx-0 md:scroll-pl-0 md:gap-5 md:px-0"
      >
        {EXAMPLES.map((ex, i) => (
          <div key={ex.id} className="w-[88%] shrink-0 snap-start pr-3 sm:w-[48%] md:pr-0 lg:w-[calc(33.333%-14px)]">
            <article
              role="button"
              tabIndex={0}
              onClick={() => setOpenIdx(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenIdx(i);
                }
              }}
              aria-label={`Открыть пример: ${ex.title}`}
              className="group cursor-pointer overflow-hidden rounded-2xl border border-line bg-white transition-all duration-300 hover:-translate-y-1.5 hover:border-violet hover:shadow-[0_22px_44px_rgba(118,88,246,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
            >
              <div className="flex items-center gap-1.5 border-b border-line bg-soft px-3 py-2" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-ink-900/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-ink-900/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-ink-900/15" />
                <span className="ml-2 truncate text-[11px] text-muted">m-navi.ru · {ex.title}</span>
              </div>
              <ScaledPreview ex={ex} />
              <div className="border-t border-line p-5">
                <h3 className="font-display text-base text-ink-900">{ex.title}</h3>
                <p className="mt-1.5 min-h-[3.5rem] text-sm text-muted">{ex.text}</p>
                <p className="mt-2 text-sm font-semibold text-violet transition-transform group-hover:translate-x-1">Смотреть крупнее →</p>
              </div>
            </article>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Демонстрация на тестовых данных: бизнес вымышлен, цифры придуманы для примера и не являются результатами клиентов.
      </p>

      {openIdx !== null && <ExampleModal index={openIdx} onClose={close} onChange={setOpenIdx} />}
    </div>
  );
}

function ExampleModal({ index, onClose, onChange }: { index: number; onClose: () => void; onChange: (i: number) => void }) {
  const ex = EXAMPLES[index];
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const go = (d: 1 | -1) => onChange((index + d + EXAMPLES.length) % EXAMPLES.length);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const raf = requestAnimationFrame(() => setEntered(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [index]);

  const Full = ex.full;
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/80 p-3 backdrop-blur-sm transition-opacity duration-200 sm:p-6 ${entered ? "opacity-100" : "opacity-0"}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Пример: ${ex.title}`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl transition-all duration-300 ${entered ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-soft px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="truncate font-display text-base text-ink-900">{ex.title}</p>
            <p className="text-xs text-muted">Пример на тестовых данных · {index + 1} из {EXAMPLES.length}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => go(-1)} aria-label="Предыдущий пример" className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-900 hover:bg-white">‹</button>
            <button onClick={() => go(1)} aria-label="Следующий пример" className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink-900 hover:bg-white">›</button>
            <button ref={closeRef} onClick={onClose} aria-label="Закрыть" className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-900 text-lg text-white hover:bg-ink-800">×</button>
          </div>
        </div>
        <div ref={bodyRef} className="overflow-y-auto p-4 sm:p-8">
          <Full />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-soft px-4 py-3 sm:px-6">
          <p className="text-xs text-muted">Бизнес вымышлен, цифры придуманы для примера.</p>
          <a href="#wizard" onClick={onClose} className="rounded-full bg-brand px-5 py-2.5 text-sm font-extrabold text-ink-900 transition-transform hover:-translate-y-0.5">
            Построить свой план
          </a>
        </div>
      </div>
    </div>
  );
}
