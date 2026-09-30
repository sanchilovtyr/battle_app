"use client";

import { useEffect, useState } from "react";
import { ChecklistState, phaseProgress } from "@/lib/checklist";
import { GeneratedPlan, Phase } from "@/lib/types";

interface PhaseBadgesProps {
  businessId: string;
  plan: GeneratedPlan;
  checklist: ChecklistState;
}

const PHASES: { key: Phase; label: string; icon: string }[] = [
  { key: "foundation", label: "Фундамент заложен", icon: "🏗" },
  { key: "traffic", label: "Трафик настроен", icon: "📈" },
  { key: "retention", label: "Клиенты удерживаются", icon: "🔁" },
];

function seenKey(businessId: string) {
  return `promoplan_badges_seen_${businessId}`;
}

function getSeen(businessId: string): string[] {
  try {
    const raw = window.localStorage.getItem(seenKey(businessId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function markSeen(businessId: string, phase: string) {
  try {
    const next = Array.from(new Set([...getSeen(businessId), phase]));
    window.localStorage.setItem(seenKey(businessId), JSON.stringify(next));
  } catch {
    // не критично
  }
}

/** Значки за полностью выполненные этапы плана — визуализация того же
 *  прогресса, что и чек-лист, но с моментом награды, а не просто зелёной
 *  полоской. Только для тарифов с чек-листом — без него фазы нечего
 *  "выполнять". */
export default function PhaseBadges({ businessId, plan, checklist }: PhaseBadgesProps) {
  const [seen, setSeen] = useState<string[]>([]);
  const [justEarned, setJustEarned] = useState<string | null>(null);

  const earned = PHASES.filter((p) => {
    const entries = plan[p.key];
    if (entries.length === 0) return false;
    return phaseProgress(checklist, entries).pct === 100;
  }).map((p) => p.key);

  useEffect(() => {
    setSeen(getSeen(businessId));
  }, [businessId]);

  useEffect(() => {
    const newlyEarned = earned.find((key) => !seen.includes(key));
    if (newlyEarned) {
      setJustEarned(newlyEarned);
      markSeen(businessId, newlyEarned);
      setSeen((prev) => [...prev, newlyEarned]);
      const t = setTimeout(() => setJustEarned(null), 4000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earned.join(","), businessId]);

  return (
    <div className="flex flex-wrap gap-2">
      {PHASES.map((p) => {
        const isEarned = earned.includes(p.key);
        return (
          <span
            key={p.key}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              isEarned
                ? `bg-brand text-ink-900 ${justEarned === p.key ? "ring-2 ring-violet ring-offset-2" : ""}`
                : "bg-soft text-ink-900/35"
            }`}
          >
            <span className={isEarned ? "" : "opacity-40"}>{isEarned ? p.icon : "🔒"}</span>
            {p.label}
          </span>
        );
      })}
    </div>
  );
}
