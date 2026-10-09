import type { Delta } from "@/lib/dashboard";
import { fmtDelta } from "@/lib/dashboard";

const TONE = {
  good: { text: "text-emerald-700", bar: "border-t-emerald-500", icon: "▲" },
  bad: { text: "text-red-700", bar: "border-t-red-500", icon: "▼" },
  neutral: { text: "text-muted", bar: "border-t-ink-900", icon: "●" },
} as const;

interface Props {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  delta?: Delta | null;
  tone?: "good" | "bad" | "neutral";
}

/** Плитка показателя: значение, изменение к прошлому периоду (стрелка + текст, не только цвет). */
export default function KpiTile({ label, value, unit, hint, delta = null, tone = "neutral" }: Props) {
  const t = TONE[delta ? tone : "neutral"];
  const arrow = !delta ? "" : delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "●";
  return (
    <div className={`rounded-xl border border-line border-t-2 bg-white p-4 ${t.bar}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1.5 font-display text-2xl leading-none text-ink-900 sm:text-3xl">
        {value}
        {unit && value !== "—" && <span className="ml-1 text-base text-muted">{unit}</span>}
      </p>
      <p className={`mt-2 min-h-[1rem] text-xs ${t.text}`}>
        {delta ? (
          <>
            <span aria-hidden>{arrow} </span>
            {fmtDelta(delta)} к прошлому периоду
          </>
        ) : (
          <span className="text-muted">{hint ?? ""}</span>
        )}
      </p>
    </div>
  );
}
