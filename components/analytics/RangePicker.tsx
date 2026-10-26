"use client";

import { useState } from "react";

export interface RangeValue {
  /** Быстрый период в днях или null, если выбраны свои даты */
  days: number | null;
  from: string;
  to: string;
}

export const DEFAULT_RANGE: RangeValue = { days: 30, from: "", to: "" };

const PRESETS: { days: number; label: string }[] = [
  { days: 1, label: "Сегодня" },
  { days: 7, label: "7 дней" },
  { days: 30, label: "30 дней" },
  { days: 90, label: "90 дней" },
  { days: 365, label: "Год" },
];

export function rangeQuery(v: RangeValue): string {
  return v.days ? `days=${v.days}` : `from=${v.from}&to=${v.to}`;
}

const todayMsk = () => new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);

export default function RangePicker({ value, onChange }: { value: RangeValue; onChange: (v: RangeValue) => void }) {
  const [from, setFrom] = useState(value.from || "");
  const [to, setTo] = useState(value.to || "");
  const today = todayMsk();
  const canApply = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.days}
          onClick={() => onChange({ days: p.days, from: "", to: "" })}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${value.days === p.days ? "bg-ink-900 text-white" : "border border-line bg-white text-ink-900"}`}
        >
          {p.label}
        </button>
      ))}
      <span className="mx-1 hidden text-sm text-muted sm:inline">или свой период:</span>
      <div className={`flex flex-wrap items-center gap-2 rounded-full border px-3 py-1.5 ${value.days === null ? "border-ink-900" : "border-line"} bg-white`}>
        <label className="sr-only" htmlFor="an-from">С даты</label>
        <input id="an-from" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="bg-transparent text-sm text-ink-900 outline-none" />
        <span className="text-muted">—</span>
        <label className="sr-only" htmlFor="an-to">По дату</label>
        <input id="an-to" type="date" value={to} max={today} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="bg-transparent text-sm text-ink-900 outline-none" />
        <button
          disabled={!canApply}
          onClick={() => onChange({ days: null, from, to })}
          className="rounded-full bg-ink-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-40"
        >
          Показать
        </button>
      </div>
    </div>
  );
}
