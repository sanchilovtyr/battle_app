"use client";

import { useMemo, useState } from "react";
import { MOCK_USERS } from "@/lib/adminMockData";
import { getPlan } from "@/lib/plans";

type Period = "month" | "quarter" | "year";

const PERIOD_LABELS: Record<Period, string> = {
  month: "За месяц",
  quarter: "За квартал",
  year: "За год",
};

const PERIOD_MULTIPLIER: Record<Period, number> = {
  month: 1,
  quarter: 3,
  year: 12,
};

function parsePrice(price: string): number {
  return Number(price.replace(/[^\d]/g, "")) || 0;
}

export default function AdminRevenueTab() {
  const [period, setPeriod] = useState<Period>("month");

  const activeSubscribers = useMemo(
    () => MOCK_USERS.filter((u) => u.status === "active" && getPlan(u.planId).price !== "0 ₽"),
    []
  );

  const mrr = useMemo(
    () => activeSubscribers.reduce((sum, u) => sum + parsePrice(getPlan(u.planId).price), 0),
    [activeSubscribers]
  );

  const byPlan = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    for (const u of activeSubscribers) {
      const plan = getPlan(u.planId);
      const entry = map.get(plan.id) ?? { name: plan.name, revenue: 0, count: 0 };
      entry.revenue += parsePrice(plan.price);
      entry.count += 1;
      map.set(plan.id, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [activeSubscribers]);

  const total = mrr * PERIOD_MULTIPLIER[period];
  const maxRevenue = Math.max(...byPlan.map((p) => p.revenue), 1);

  return (
    <div>
      <div className="mb-5 rounded-xl border border-violet/30 bg-violet-soft p-4 text-sm text-violet">
        Демо-данные: суммы посчитаны по тарифам демонстрационных пользователей, а не по реальным
        платежам — в системе пока нет платёжного бэкенда, который бы их фиксировал.
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              period === p ? "bg-ink-900 text-white" : "border border-line bg-white text-ink-900"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-line bg-white p-6">
        <p className="text-sm text-muted">{PERIOD_LABELS[period]}</p>
        <p className="mt-1 font-display text-4xl text-ink-900">
          {total.toLocaleString("ru-RU")} ₽
        </p>
        <p className="mt-2 text-sm text-muted">
          {activeSubscribers.length} платящих подписчиков · MRR {mrr.toLocaleString("ru-RU")} ₽/мес
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-white p-6">
        <h3 className="mb-4 font-display text-base text-ink-900">По тарифам (MRR)</h3>
        <div className="space-y-3">
          {byPlan.map((p) => (
            <div key={p.name}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-ink-900">
                  {p.name} <span className="text-muted">· {p.count}</span>
                </span>
                <span className="font-medium text-ink-900">{p.revenue.toLocaleString("ru-RU")} ₽</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-soft">
                <div
                  className="h-full rounded-full bg-violet"
                  style={{ width: `${(p.revenue / maxRevenue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
