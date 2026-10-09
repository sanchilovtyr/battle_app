"use client";

import { useEffect, useState } from "react";
import { GeneratedPlan } from "@/lib/types";
import { ChecklistState } from "@/lib/checklist";
import { FunnelSnapshot } from "@/lib/funnel";
import { GrowthTarget } from "@/lib/growthTarget";
import { computeGrowthPoints, GrowthPoint } from "@/lib/growthPoints";
import { GrowthPointOverrideData } from "@/lib/adminGrowthPoints";

function applyOverrides(
  points: GrowthPoint[],
  overrides: Record<string, GrowthPointOverrideData>
): GrowthPoint[] {
  return points.map((p) => {
    const o = overrides[p.id];
    if (!o) return p;
    return { ...p, title: o.title, body: o.body, action: o.action || undefined };
  });
}

export function LockedGrowthPoints() {
  return (
    <div className="rounded-2xl border border-dashed border-ink-900/20 bg-soft p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-brand">
        🔒
      </div>
      <h3 className="font-display text-lg text-ink-900 mb-1.5">Точки роста компании</h3>
      <p className="mx-auto mb-4 max-w-md text-sm text-muted">
        На тарифе «Премиум» точки роста сверяют чек-лист, воронку и данные Яндекс.Метрики между
        собой и показывают, где конкретно стоит усилить продвижение — а не просто общие советы.
      </p>
      <a
        href="/#pricing"
        className="inline-block rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-ink-800"
      >
        Посмотреть тарифы
      </a>
    </div>
  );
}

interface GrowthPointsProps {
  businessId: string;
  plan: GeneratedPlan;
  checklist: ChecklistState;
  snapshots: FunnelSnapshot[];
  target: GrowthTarget;
}

interface MetrikaStatus {
  connected: boolean;
  counterId?: string | null;
  leadsGoalId?: string | null;
  salesGoalId?: string | null;
}

export default function GrowthPoints({ businessId, plan, checklist, snapshots, target }: GrowthPointsProps) {
  const [metrika, setMetrika] = useState<MetrikaStatus>({ connected: false });
  const [overrides, setOverrides] = useState<Record<string, GrowthPointOverrideData>>({});

  useEffect(() => {
    fetch(`/api/metrika/status?businessId=${businessId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setMetrika(data);
      })
      .catch(() => {});
  }, [businessId]);

  useEffect(() => {
    fetch("/api/growth-points/overrides")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setOverrides(data?.overrides ?? {}))
      .catch(() => {});
  }, []);

  const points = applyOverrides(
    computeGrowthPoints({
      plan,
      checklist,
      snapshots,
      metrikaConnected: Boolean(metrika.connected && metrika.counterId),
      metrikaGoalsSet: Boolean(metrika.leadsGoalId || metrika.salesGoalId),
      target,
    }),
    overrides
  );

  return (
    <section className="rounded-2xl border border-line bg-white p-5 md:p-6">
      <h3 className="font-display text-lg text-ink-900 mb-1.5">Точки роста компании</h3>
      <p className="mb-5 text-sm text-muted">
        Сверяем чек-лист, воронку и Метрику между собой — не общие советы, а то, что видно именно
        по вашим цифрам.
      </p>
      <ul className="space-y-4">
        {points.map((p) => (
          <li key={p.id} className="rounded-xl border border-violet/20 bg-violet-soft/40 p-4">
            <p className="font-medium text-ink-900">{p.title}</p>
            <p className="mt-1.5 text-sm text-ink-900/80">{p.body}</p>
            {p.action && (
              <p className="mt-2.5 text-sm font-medium text-violet">→ {p.action}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
