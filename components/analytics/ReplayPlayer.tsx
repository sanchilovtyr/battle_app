"use client";

import { useEffect, useRef, useState } from "react";
import { Replayer } from "rrweb";
import "rrweb/dist/style.css";

/** Проигрыватель записи сессии (rrweb). Подгружается только в админке. */
export default function ReplayPlayer({ events }: { events: unknown[] }) {
  const box = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const rep = useRef<Replayer | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [total, setTotal] = useState(0);
  const [cur, setCur] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [boxH, setBoxH] = useState(420);

  useEffect(() => {
    if (!holder.current || !box.current) return;
    if (events.length < 2) {
      setErr("В записи слишком мало данных.");
      return;
    }
    let r: Replayer | null = null;
    let tick: ReturnType<typeof setInterval> | null = null;
    try {
      r = new Replayer(events as never[], {
        root: holder.current,
        skipInactive: true,
        mouseTail: { strokeStyle: "#7c5cff", lineWidth: 2, duration: 400 },
        speed: 1,
      });
      rep.current = r;
      const fit = (w: number, h: number) => {
        const avail = box.current?.clientWidth || w;
        const scale = Math.min(1, avail / w);
        const wrap = r!.wrapper as HTMLElement;
        wrap.style.transformOrigin = "top left";
        wrap.style.transform = `scale(${scale})`;
        setBoxH(Math.max(240, Math.round(h * scale)));
      };
      r.on("resize", (d: unknown) => {
        const { width, height } = d as { width: number; height: number };
        fit(width, height);
      });
      r.on("finish", () => setPlaying(false));
      setTotal(r.getMetaData().totalTime);
      r.play();
      tick = setInterval(() => r && setCur(r.getCurrentTime()), 300);
    } catch {
      setErr("Не удалось воспроизвести запись.");
    }
    return () => {
      if (tick) clearInterval(tick);
      try {
        r?.destroy();
      } catch {
        /* уже закрыт */
      }
      rep.current = null;
    };
  }, [events]);

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div>
      {err && <p className="mb-3 text-sm text-red-700">{err}</p>}
      <div ref={box} className="overflow-hidden rounded-xl border border-line bg-soft" style={{ height: boxH }}>
        <div ref={holder} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            const r = rep.current;
            if (!r) return;
            if (playing) r.pause();
            else r.play(cur >= total ? 0 : cur);
            setPlaying(!playing);
          }}
          className="rounded-full bg-ink-900 px-4 py-1.5 text-sm font-medium text-white"
        >
          {playing ? "Пауза" : "Играть"}
        </button>
        <input
          aria-label="Позиция в записи"
          type="range"
          min={0}
          max={Math.max(1, total)}
          value={Math.min(cur, total)}
          onChange={(e) => {
            const t = Number(e.target.value);
            setCur(t);
            if (playing) rep.current?.play(t);
            else rep.current?.pause(t);
          }}
          className="min-w-[160px] flex-1"
        />
        <span className="text-xs text-muted">
          {fmt(cur)} / {fmt(total)}
        </span>
        <select
          aria-label="Скорость"
          value={speed}
          onChange={(e) => {
            const v = Number(e.target.value);
            setSpeed(v);
            rep.current?.setConfig({ speed: v });
          }}
          className="rounded-lg border border-line bg-white px-2 py-1 text-sm"
        >
          {[1, 2, 4, 8].map((v) => (
            <option key={v} value={v}>
              ×{v}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
