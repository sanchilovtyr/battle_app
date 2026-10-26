"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CLICK_GRID, DEVICE_WIDTH, Device, scrollReach } from "@/lib/analyticsCore";

interface PageRow { path: string; device: string; clicks: number; views: number }
interface HeatData {
  grid: number;
  clicks: { selector: string; xb: number; yb: number; count: number }[];
  scrollHist: number[];
}

const DEVICES: { id: Device; label: string }[] = [
  { id: "desktop", label: "Компьютер" },
  { id: "tablet", label: "Планшет" },
  { id: "mobile", label: "Телефон" },
];
const num = (n: number) => n.toLocaleString("ru-RU");

interface Resolved { selector: string; label: string; total: number; rect: { x: number; y: number; w: number; h: number } | null }

function labelFor(el: Element, selector: string): string {
  const e = el as HTMLElement;
  const t = (e.getAttribute("aria-label") || e.innerText || e.getAttribute("alt") || e.getAttribute("title") || "").replace(/\s+/g, " ").trim();
  if (t) return t.length > 60 ? t.slice(0, 57) + "…" : t;
  const img = e.querySelector("img[alt]");
  if (img?.getAttribute("alt")) return img.getAttribute("alt")!.slice(0, 60);
  return selector.split(" > ").slice(-1)[0];
}

export default function AnalyticsHeatmap({ mode }: { mode: "clicks" | "scroll" }) {
  const [pages, setPages] = useState<PageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<string>("");
  const [device, setDevice] = useState<Device>("desktop");
  const [data, setData] = useState<HeatData | null>(null);
  const [frameH, setFrameH] = useState(1600);
  const [frameReady, setFrameReady] = useState(0);
  const [avail, setAvail] = useState(1000);
  const [resolved, setResolved] = useState<Resolved[]>([]);
  const [missing, setMissing] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const W = DEVICE_WIDTH[device];
  const scale = Math.min(1, avail / W);

  useEffect(() => {
    fetch("/api/admin/analytics/heat")
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Ошибка загрузки");
        return j.pages as PageRow[];
      })
      .then((p) => {
        setPages(p);
        const first = p.find((x) => (mode === "clicks" ? x.clicks : x.views) > 0) || p[0];
        if (first) {
          setPath(first.path);
          setDevice((first.device as Device) || "desktop");
        }
      })
      .catch((e) => setError(String(e.message || e)));
  }, [mode]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvail(Math.max(300, el.clientWidth)));
    ro.observe(el);
    setAvail(Math.max(300, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setData(null);
    setPick(null);
    fetch(`/api/admin/analytics/heat?path=${encodeURIComponent(path)}&device=${device}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Ошибка загрузки");
        return j as HeatData;
      })
      .then((j) => alive && setData(j))
      .catch((e) => alive && setError(String(e.message || e)));
    return () => {
      alive = false;
    };
  }, [path, device]);

  // Высота страницы в рамке меняется, пока грузятся картинки и шрифты — измеряем несколько раз
  const onFrameLoad = useCallback(() => {
    const measure = () => {
      try {
        const d = iframe.current?.contentDocument;
        if (!d) return;
        const h = Math.max(d.documentElement.scrollHeight, d.body?.scrollHeight || 0);
        if (h > 200) setFrameH((old) => (Math.abs(old - h) > 4 ? h : old));
        setFrameReady((n) => n + 1);
      } catch {
        /* чужая страница */
      }
    };
    [100, 900, 2500, 5000].forEach((t) => setTimeout(measure, t));
  }, []);

  // Привязка кликов к элементам страницы в рамке
  useEffect(() => {
    if (mode !== "clicks" || !data) return;
    const d = iframe.current?.contentDocument;
    if (!d) return;
    const bySel = new Map<string, number>();
    for (const c of data.clicks) bySel.set(c.selector, (bySel.get(c.selector) || 0) + c.count);
    const out: Resolved[] = [];
    let miss = 0;
    bySel.forEach((total, selector) => {
      let el: Element | null = null;
      try {
        el = d.querySelector(selector);
      } catch {
        el = null;
      }
      if (!el) {
        miss += total;
        return;
      }
      const r = el.getBoundingClientRect();
      const sy = d.defaultView?.scrollY || 0;
      out.push({ selector, label: labelFor(el, selector), total, rect: { x: r.left, y: r.top + sy, w: r.width, h: r.height } });
    });
    out.sort((a, b) => b.total - a.total);
    setResolved(out);
    setMissing(miss);
  }, [data, mode, frameReady, frameH]);

  // Рисование тепловой карты кликов
  useEffect(() => {
    if (mode !== "clicks") return;
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!data) return;
    const d = iframe.current?.contentDocument;
    if (!d) return;
    const rects = new Map(resolved.map((r) => [r.selector, r.rect]));
    const max = Math.max(1, ...data.clicks.map((c) => c.count));
    const R = Math.max(18, Math.min(38, W / 40));
    const sorted = [...data.clicks].sort((a, b) => a.count - b.count);
    for (const c of sorted) {
      const rc = rects.get(c.selector);
      if (!rc) continue;
      const x = rc.x + ((c.xb + 0.5) / CLICK_GRID) * rc.w;
      const y = rc.y + ((c.yb + 0.5) / CLICK_GRID) * rc.h;
      const k = c.count / max;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      const hue = Math.round(60 - 60 * k); // жёлтый → красный
      g.addColorStop(0, `hsla(${hue},100%,50%,${0.35 + 0.5 * k})`);
      g.addColorStop(1, `hsla(${hue},100%,50%,0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [resolved, data, mode, W, frameH]);

  const totalClicks = useMemo(() => (data ? data.clicks.reduce((a, c) => a + c.count, 0) : 0), [data]);
  const sc = useMemo(() => scrollReach(data?.scrollHist ?? []), [data]);
  const paths = useMemo(() => Array.from(new Set((pages ?? []).map((p) => p.path))), [pages]);
  const devCount = (dv: Device) => {
    const r = (pages ?? []).find((p) => p.path === path && p.device === dv);
    return r ? (mode === "clicks" ? r.clicks : r.views) : 0;
  };
  const picked = resolved.find((r) => r.selector === pick) || null;

  return (
    <div>
      <p className="mb-5 rounded-xl border border-line bg-soft p-3 text-xs text-muted">
        {mode === "clicks"
          ? "Красные и жёлтые пятна — места, куда чаще всего кликали. Клики считаются по элементам страницы, поэтому после изменения вёрстки старые данные могут «съехать». Данные копятся с момента обновления сайта."
          : "Полосы показывают, какая доля просмотров страницы дошла до этого места: красный — почти все, синий — единицы. Данные копятся с момента обновления сайта."}
      </p>
      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">{error}</div>}
      {!pages && !error && <p className="text-sm text-muted">Загрузка…</p>}
      {pages && pages.length === 0 && <p className="text-sm text-muted">Данных пока нет — они появятся после первых заходов на сайт.</p>}
      {pages && pages.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-900">
              Страница
              <select
                value={path}
                onChange={(e) => {
                  setPath(e.target.value);
                  const first = pages.find((p) => p.path === e.target.value);
                  if (first) setDevice(first.device as Device);
                }}
                className="max-w-[260px] rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
              >
                {paths.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              {DEVICES.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDevice(d.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${device === d.id ? "bg-ink-900 text-white" : "border border-line bg-white text-ink-900"}`}
                >
                  {d.label} <span className="opacity-60">{num(devCount(d.id))}</span>
                </button>
              ))}
            </div>
            {data && mode === "clicks" && <span className="text-sm text-muted">Кликов: {num(totalClicks)}</span>}
            {data && mode === "scroll" && <span className="text-sm text-muted">Просмотров: {num(sc.views)} · дошли до конца: {sc.reach[9]}%</span>}
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <div ref={wrap} className="min-w-0 overflow-hidden rounded-xl border border-line bg-white">
              <div style={{ width: W * scale, height: frameH * scale, position: "relative" }}>
                <div style={{ width: W, height: frameH, transform: `scale(${scale})`, transformOrigin: "0 0", position: "relative" }}>
                  <iframe
                    key={path + device}
                    ref={iframe}
                    src={path}
                    title="Страница сайта"
                    onLoad={onFrameLoad}
                    style={{ width: W, height: frameH, border: 0, display: "block" }}
                    scrolling="no"
                  />
                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                    {mode === "clicks" && (
                      <>
                        <canvas ref={canvas} width={W} height={frameH} style={{ width: W, height: frameH }} />
                        {picked?.rect && (
                          <div
                            style={{
                              position: "absolute",
                              left: picked.rect.x,
                              top: picked.rect.y,
                              width: picked.rect.w,
                              height: picked.rect.h,
                              outline: "3px solid #7c5cff",
                              background: "rgba(124,92,255,0.12)",
                            }}
                          />
                        )}
                      </>
                    )}
                    {mode === "scroll" &&
                      sc.reach.map((p, k) => (
                        <div
                          key={k}
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: `${k * 10}%`,
                            height: "10%",
                            background: `hsla(${Math.round(220 * (1 - p / 100))},90%,50%,${sc.views ? 0.28 : 0})`,
                            borderBottom: "1px dashed rgba(0,0,0,0.25)",
                          }}
                        >
                          <span style={{ position: "absolute", left: 10, top: 8, background: "rgba(0,0,0,0.75)", color: "#fff", padding: "2px 8px", borderRadius: 999, fontSize: 18, fontWeight: 600 }}>
                            {p}%
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            <aside className="rounded-xl border border-line bg-white p-4 lg:max-h-[80vh] lg:overflow-y-auto">
              {mode === "clicks" ? (
                <>
                  <h3 className="mb-2 font-display text-base text-ink-900">Куда кликали</h3>
                  {resolved.length === 0 && <p className="text-sm text-muted">{data ? "Нет кликов по этой странице." : "Загрузка…"}</p>}
                  <ul className="space-y-1.5">
                    {resolved.slice(0, 30).map((r) => (
                      <li key={r.selector}>
                        <button
                          onClick={() => setPick(pick === r.selector ? null : r.selector)}
                          className={`flex w-full items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${pick === r.selector ? "bg-soft" : "hover:bg-soft"}`}
                        >
                          <span className="break-words text-ink-900">{r.label}</span>
                          <span className="whitespace-nowrap text-muted">
                            {num(r.total)} · {totalClicks ? Math.round((r.total / totalClicks) * 100) : 0}%
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {missing > 0 && <p className="mt-3 text-xs text-muted">Ещё {num(missing)} кликов пришлись на элементы, которых на странице уже нет (вёрстка менялась) или которые появляются только по действию (окна, меню).</p>}
                </>
              ) : (
                <>
                  <h3 className="mb-2 font-display text-base text-ink-900">Глубина просмотра</h3>
                  {sc.views === 0 && <p className="text-sm text-muted">{data ? "Просмотров этой страницы с таким устройством пока нет." : "Загрузка…"}</p>}
                  {sc.views > 0 && (
                    <ul className="space-y-1 text-sm">
                      {sc.reach.map((p, k) => (
                        <li key={k} className="flex justify-between border-b border-line py-1 last:border-0">
                          <span className="text-ink-900">{k === 0 ? "Верх страницы" : `${k * 10}% страницы`}</span>
                          <span className="text-muted">{p}%</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
