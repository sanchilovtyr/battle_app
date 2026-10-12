"use client";

import { useEffect, useRef, useState } from "react";

export interface LineSeries {
  name: string;
  color: string;
  values: (number | null)[];
}

export interface RefLine {
  value: number;
  label: string;
  color: string;
}

interface Props {
  title: string;
  subtitle?: string;
  /** Короткие подписи оси X и полные — для подсказки и таблицы. */
  categories: string[];
  fullLabels?: string[];
  series: LineSeries[];
  format?: (n: number) => string;
  refLines?: RefLine[];
  height?: number;
  emptyHint?: string;
}

const M = { top: 14, right: 58, bottom: 28, left: 46 };

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * exp;
}

function axisFmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} млн`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)} тыс`;
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
}

/** Линейный график на SVG: одна ось, тонкие линии, подсказка по наведению и с клавиатуры,
 *  легенда при двух и более линиях, таблица как альтернативный вид. */
export default function LineChart({
  title,
  subtitle,
  categories,
  fullLabels,
  series,
  format = (n) => n.toLocaleString("ru-RU", { maximumFractionDigits: 1 }),
  refLines = [],
  height = 230,
  emptyHint = "Пока нет данных для этого графика.",
}: Props) {
  const n = categories.length;
  const hasData = n > 0 && series.some((s) => s.values.some((v) => v !== null));
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    setWidth(Math.max(260, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, [table, hasData]);

  const labels = fullLabels ?? categories;

  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null)).concat(refLines.map((r) => r.value));
  const yMax = niceMax(Math.max(...all, 1));
  const innerW = Math.max(1, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const x = (i: number) => M.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (v / yMax) * innerH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);
  // подписи оси X — не чаще, чем помещаются
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 64))));

  const segments = (s: LineSeries) => {
    const out: { i: number; v: number }[][] = [];
    let cur: { i: number; v: number }[] = [];
    s.values.forEach((v, i) => {
      if (v === null) {
        if (cur.length) out.push(cur);
        cur = [];
      } else cur.push({ i, v });
    });
    if (cur.length) out.push(cur);
    return out;
  };

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left + M.left;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHover(best);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (n === 0) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setHover((h) => (h === null ? 0 : Math.min(n - 1, h + 1)));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setHover((h) => (h === null ? n - 1 : Math.max(0, h - 1)));
    } else if (e.key === "Escape") setHover(null);
  };

  const tipLeft = hover !== null ? x(hover) : 0;
  const flip = tipLeft > width * 0.6;

  return (
    <figure className="rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <figcaption className="font-display text-base text-ink-900">{title}</figcaption>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {hasData && (
          <button
            type="button"
            onClick={() => setTable((v) => !v)}
            aria-pressed={table}
            className="rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors hover:border-ink-900/30 hover:text-ink-900"
          >
            {table ? "График" : "Таблица"}
          </button>
        )}
      </div>

      {series.length >= 2 && hasData && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-900">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded" style={{ background: s.color }} aria-hidden />
              {s.name}
            </li>
          ))}
        </ul>
      )}

      {!hasData ? (
        <p className="rounded-xl bg-soft p-6 text-center text-sm text-muted">{emptyHint}</p>
      ) : table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="py-2 pr-3 font-medium">Период</th>
                {series.map((s) => (
                  <th key={s.name} className="py-2 pr-3 font-medium">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={i} className="border-b border-line/60 last:border-0">
                  <td className="py-2 pr-3 text-ink-900">{l}</td>
                  {series.map((s) => (
                    <td key={s.name} className="py-2 pr-3 text-ink-900">{s.values[i] === null ? "—" : format(s.values[i] as number)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrapRef} className="relative" onPointerLeave={() => setHover(null)}>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${title}. ${series.map((s) => `${s.name}: ${s.values.filter((v) => v !== null).length} значений`).join("; ")}. Стрелками влево и вправо можно перебирать периоды.`}
            tabIndex={0}
            onKeyDown={onKey}
            onBlur={() => setHover(null)}
            className="block max-w-full overflow-visible rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet"
          >
            {/* сетка и ось Y */}
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="#E7E8EE" strokeWidth={1} />
                <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#70758A">
                  {axisFmt(t)}
                </text>
              </g>
            ))}
            {/* ось X */}
            {categories.map((c, i) =>
              i % every === 0 || i === n - 1 ? (
                <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="#70758A">
                  {c}
                </text>
              ) : null
            )}
            {/* целевые линии */}
            {refLines.map((r) => (
              <g key={r.label}>
                <line x1={M.left} x2={width - M.right} y1={y(r.value)} y2={y(r.value)} stroke={r.color} strokeWidth={1.5} strokeDasharray="5 4" />
                <text x={M.left + 4} y={y(r.value) - 5} fontSize={11} fill="#111525" stroke="#fff" strokeWidth={3} paintOrder="stroke">
                  {r.label}: {format(r.value)}
                </text>
              </g>
            ))}
            {/* перекрестие */}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + innerH} stroke="#111525" strokeOpacity={0.25} strokeWidth={1} />}
            {/* линии */}
            {series.map((s) => (
              <g key={s.name}>
                {segments(s).map((seg, k) => (
                  <polyline
                    key={k}
                    points={seg.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ))}
                {n <= 24 &&
                  s.values.map((v, i) =>
                    v === null ? null : (
                      <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3.5} fill={s.color} stroke="#fff" strokeWidth={2} />
                    )
                  )}
                {/* прямая подпись последнего значения */}
                {(() => {
                  let li = -1;
                  s.values.forEach((v, i) => {
                    if (v !== null) li = i;
                  });
                  return li >= 0 ? (
                    <text x={x(li) + 9} y={y(s.values[li] as number) + 4} fontSize={11} fontWeight={700} fill="#111525">
                      {format(s.values[li] as number)}
                    </text>
                  ) : null;
                })()}
              </g>
            ))}
            {/* зона наведения шире линий */}
            <rect x={M.left} y={M.top} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} />
          </svg>

          {hover !== null && (
            <div
              role="status"
              className="pointer-events-none absolute z-10 min-w-[150px] rounded-xl border border-line bg-white p-3 text-xs shadow-lg"
              style={{ top: 8, left: flip ? undefined : tipLeft + 12, right: flip ? width - tipLeft + 12 : undefined }}
            >
              <p className="mb-1.5 font-medium text-ink-900">{labels[hover]}</p>
              {series.map((s) => (
                <p key={s.name} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} aria-hidden />
                    {s.name}
                  </span>
                  <b className="text-ink-900">{s.values[hover] === null ? "—" : format(s.values[hover] as number)}</b>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
