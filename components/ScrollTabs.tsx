"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ScrollTabsProps<T extends string> {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}

/** Полоса вкладок с горизонтальной прокруткой: стрелки ‹ › на десктопе, прокрутка
 *  колесом мыши и перетаскиванием, активная вкладка всегда в поле зрения. */
export default function ScrollTabs<T extends string>({ tabs, active, onChange }: ScrollTabsProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const drag = useRef({ down: false, x: 0, left: 0, moved: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Колесо мыши (вертикальное) крутит полосу горизонтально, пока есть куда крутить
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0;
      if (atStart || atEnd) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", onWheel);
    };
  }, [update]);

  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !ref.current) return;
    const box = ref.current;
    const left = el.offsetLeft - 48;
    const right = el.offsetLeft + el.offsetWidth + 48;
    if (left < box.scrollLeft) box.scrollTo({ left, behavior: "smooth" });
    else if (right > box.scrollLeft + box.clientWidth) box.scrollTo({ left: right - box.clientWidth, behavior: "smooth" });
  }, [active]);

  const step = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * Math.max(200, el.clientWidth * 0.6), behavior: "smooth" });
  };

  const arrow =
    "absolute top-0 z-10 hidden h-[38px] w-9 items-center justify-center rounded-full border border-line bg-white text-lg text-ink-900 shadow-sm hover:bg-soft md:flex";

  return (
    <div className="relative">
      {canLeft && (
        <button type="button" aria-label="Прокрутить вкладки влево" onClick={() => step(-1)} className={`${arrow} left-0`}>
          ‹
        </button>
      )}
      <div
        ref={ref}
        role="tablist"
        aria-label="Разделы админ-панели"
        onScroll={update}
        onMouseDown={(e) => {
          const el = ref.current;
          if (!el) return;
          drag.current = { down: true, x: e.clientX, left: el.scrollLeft, moved: false };
        }}
        onMouseMove={(e) => {
          const d = drag.current;
          if (!d.down || !ref.current) return;
          const dx = e.clientX - d.x;
          if (Math.abs(dx) > 4) d.moved = true;
          if (d.moved) ref.current.scrollLeft = d.left - dx;
        }}
        onMouseUp={() => (drag.current.down = false)}
        onMouseLeave={() => (drag.current.down = false)}
        onClickCapture={(e) => {
          // после перетаскивания клик по вкладке не должен её переключать
          if (drag.current.moved) {
            e.stopPropagation();
            e.preventDefault();
            drag.current.moved = false;
          }
        }}
        className={`-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:px-0 ${
          canLeft ? "md:pl-11" : ""
        } ${canRight ? "md:pr-11" : ""}`}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onChange(t.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              active === t.id ? "bg-ink-900 text-white" : "border border-line text-ink-900 hover:bg-soft"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {canRight && (
        <button type="button" aria-label="Прокрутить вкладки вправо" onClick={() => step(1)} className={`${arrow} right-0`}>
          ›
        </button>
      )}
    </div>
  );
}
