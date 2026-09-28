"use client";

import { useEffect, useState } from "react";
import { ChecklistState } from "@/lib/checklist";
import { FunnelSnapshot } from "@/lib/funnel";
import { GeneratedPlan } from "@/lib/types";
import { VectorId } from "@/lib/vectors";
import { computeReadiness } from "@/lib/readiness";

interface ReadinessScoreProps {
  businessId: string;
  plan: GeneratedPlan;
  checklist: ChecklistState;
  checklistAccess: boolean;
  vectorId?: VectorId | null;
  snapshots: FunnelSnapshot[];
}

/** Одна цифра прогресса вместо нескольких разрозненных блоков — насколько
 *  бизнес использует то, что даёт сервис (вектор, чек-лист, Метрика, воронка).
 *  Подключение к Метрике подтягиваем отдельным лёгким запросом, чтобы не
 *  тянуть его через все родительские компоненты. */
export default function ReadinessScore({
  businessId,
  plan,
  checklist,
  checklistAccess,
  vectorId,
  snapshots,
}: ReadinessScoreProps) {
  const [metrikaConnected, setMetrikaConnected] = useState(false);

  useEffect(() => {
    if (!checklistAccess) return;
    fetch(`/api/metrika/status?businessId=${businessId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMetrikaConnected(Boolean(data?.connected && data?.counterId)))
      .catch(() => {});
  }, [businessId, checklistAccess]);

  const { pct, items } = computeReadiness({
    plan,
    checklist,
    checklistAccess,
    vectorId,
    snapshots,
    metrikaConnected,
  });

  return (
    <div className="rounded-2xl border border-line bg-white p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="font-display text-lg text-ink-900">Индекс готовности маркетинга</h3>
        <span className="font-display text-2xl text-violet">{pct}%</span>
      </div>
      <div className="mb-4 h-2 rounded-full bg-soft">
        <div className="h-2 rounded-full bg-violet transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span className={item.done ? "text-violet" : "text-ink-900/25"}>{item.done ? "✓" : "○"}</span>
            <span className={item.done ? "text-ink-900" : "text-muted"}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
