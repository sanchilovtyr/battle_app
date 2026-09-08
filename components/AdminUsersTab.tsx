"use client";

import { useEffect, useMemo, useState } from "react";
import { PLANS, PlanId } from "@/lib/plans";

interface RealUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  createdAt: string;
  planId: PlanId;
  status: "active" | "cancelled";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function AdminUsersTab({ onMessage }: { onMessage: (email: string) => void }) {
  const [filter, setFilter] = useState<PlanId | "all">("all");
  const [users, setUsers] = useState<RealUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Ошибка загрузки");
        return res.json();
      })
      .then((data) => setUsers(data.users))
      .catch((e) => setError(String(e.message || e)));
  }, []);

  const filtered = useMemo(
    () => (users ?? []).filter((u) => filter === "all" || u.planId === filter),
    [users, filter]
  );

  const counts = useMemo(() => {
    const list = users ?? [];
    const map: Record<string, number> = { all: list.length };
    for (const plan of PLANS) {
      map[plan.id] = list.filter((u) => u.planId === plan.id).length;
    }
    return map;
  }, [users]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            filter === "all" ? "bg-ink-900 text-white" : "border border-line bg-white text-ink-900"
          }`}
        >
          Все тарифы ({counts.all ?? 0})
        </button>
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setFilter(plan.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === plan.id ? "bg-ink-900 text-white" : "border border-line bg-white text-ink-900"
            }`}
          >
            {plan.name} ({counts[plan.id] ?? 0})
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {!users && !error && <p className="text-sm text-muted">Загрузка…</p>}

      {users && users.length === 0 && (
        <p className="text-sm text-muted">Пока никто не зарегистрировался.</p>
      )}

      {users && users.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th className="p-4 font-medium">Пользователь</th>
                <th className="p-4 font-medium">Тариф</th>
                <th className="p-4 font-medium">Статус</th>
                <th className="p-4 font-medium">Регистрация</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const plan = PLANS.find((p) => p.id === u.planId);
                return (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="p-4">
                      <div className="font-medium text-ink-900">{u.name || "—"}</div>
                      <div className="text-muted">{u.email}</div>
                      {u.phone && <div className="text-muted">{u.phone}</div>}
                    </td>
                    <td className="p-4 text-ink-900">{plan?.name ?? u.planId}</td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          u.status === "active"
                            ? "bg-violet-soft text-violet"
                            : "bg-ink-900/10 text-ink-900/60"
                        }`}
                      >
                        {u.status === "active" ? "Активен" : "Отменён"}
                      </span>
                    </td>
                    <td className="p-4 text-muted">{formatDate(u.createdAt)}</td>
                    <td className="p-4">
                      <button
                        onClick={() => onMessage(u.email)}
                        className="rounded-full border border-ink-900/20 px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-soft"
                      >
                        Написать
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
