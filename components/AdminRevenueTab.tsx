"use client";

import { useEffect, useMemo, useState } from "react";
import { getPlan, PlanId } from "@/lib/plans";

type Period = "month" | "quarter" | "year";

const PERIOD_LABELS: Record<Period, string> = {
  month: "За месяц",
  quarter: "За квартал",
  year: "За год",
};

const PERIOD_DAYS: Record<Period, number> = {
  month: 30,
  quarter: 90,
  year: 365,
};

interface PaymentRow {
  amountKopecks: number;
  planId: PlanId;
  createdAt: string;
}

export default function AdminRevenueTab() {
  const [period, setPeriod] = useState<Period>("month");
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [activeSubscribers, setActiveSubscribers] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/revenue")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Ошибка загрузки");
        return res.json();
      })
      .then((data) => {
        setPayments(data.payments);
        setActiveSubscribers(data.activeSubscribers);
      })
      .catch((e) => setError(String(e.message || e)));
  }, []);

  const periodPayments = useMemo(() => {
    if (!payments) return [];
    const cutoff = Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000;
    return payments.filter((p) => new Date(p.createdAt).getTime() >= cutoff);
  }, [payments, period]);

  const total = useMemo(
    () => periodPayments.reduce((sum, p) => sum + p.amountKopecks, 0) / 100,
    [periodPayments]
  );

  const byPlan = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    for (const p of periodPayments) {
      const plan = getPlan(p.planId);
      const entry = map.get(plan.id) ?? { name: plan.name, revenue: 0, count: 0 };
      entry.revenue += p.amountKopecks / 100;
      entry.count += 1;
      map.set(plan.id, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [periodPayments]);

  const maxRevenue = Math.max(...byPlan.map((p) => p.revenue), 1);

  return (
    <div>
      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
          {error}
        </div>
      )}

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

      {!payments && !error && <p className="text-sm text-muted">Загрузка…</p>}

      {payments && (
        <>
          <div className="mb-6 rounded-2xl border border-line bg-white p-6">
            <p className="text-sm text-muted">{PERIOD_LABELS[period]}</p>
            <p className="mt-1 font-display text-4xl text-ink-900">
              {total.toLocaleString("ru-RU")} ₽
            </p>
            <p className="mt-2 text-sm text-muted">
              {periodPayments.length} успешных платежей за период · {activeSubscribers} активных
              платящих подписчиков сейчас
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-white p-6">
            <h3 className="mb-4 font-display text-base text-ink-900">По тарифам за период</h3>
            {byPlan.length === 0 && (
              <p className="text-sm text-muted">За этот период платежей ещё не было.</p>
            )}
            <div className="space-y-3">
              {byPlan.map((p) => (
                <div key={p.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-ink-900">
                      {p.name} <span className="text-muted">· {p.count}</span>
                    </span>
                    <span className="font-medium text-ink-900">
                      {p.revenue.toLocaleString("ru-RU")} ₽
                    </span>
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
        </>
      )}
    </div>
  );
}
