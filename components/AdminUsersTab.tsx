"use client";

import { useMemo, useState } from "react";
import { MOCK_USERS } from "@/lib/adminMockData";
import { PLANS, PlanId } from "@/lib/plans";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function AdminUsersTab({ onMessage }: { onMessage: (email: string) => void }) {
  const [filter, setFilter] = useState<PlanId | "all">("all");
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const users = useMemo(
    () =>
      MOCK_USERS.filter((u) => !removedIds.includes(u.id)).filter(
        (u) => filter === "all" || u.planId === filter
      ),
    [filter, removedIds]
  );

  const counts = useMemo(() => {
    const active = MOCK_USERS.filter((u) => !removedIds.includes(u.id));
    const map: Record<string, number> = { all: active.length };
    for (const plan of PLANS) {
      map[plan.id] = active.filter((u) => u.planId === plan.id).length;
    }
    return map;
  }, [removedIds]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            filter === "all" ? "bg-ink-900 text-white" : "border border-line bg-white text-ink-900"
          }`}
        >
          Все тарифы ({counts.all})
        </button>
        {PLANS.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setFilter(plan.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === plan.id ? "bg-ink-900 text-white" : "border border-line bg-white text-ink-900"
            }`}
          >
            {plan.name} ({counts[plan.id]})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <th className="p-4 font-medium">Пользователь</th>
              <th className="p-4 font-medium">Тариф</th>
              <th className="p-4 font-medium">Статус</th>
              <th className="p-4 font-medium">Регистрация</th>
              <th className="p-4 font-medium">Скачанные файлы</th>
              <th className="p-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const plan = PLANS.find((p) => p.id === u.planId);
              return (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="p-4">
                    <div className="font-medium text-ink-900">{u.name}</div>
                    <div className="text-muted">{u.email}</div>
                    <div className="text-muted">{u.phone}</div>
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
                  <td className="p-4 text-muted">{formatDate(u.registeredAt)}</td>
                  <td className="p-4 text-muted">
                    {u.downloadedFiles.length === 0 ? (
                      "—"
                    ) : (
                      <ul className="space-y-0.5">
                        {u.downloadedFiles.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onMessage(u.email)}
                        className="rounded-full border border-ink-900/20 px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-soft"
                      >
                        Написать
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Удалить аккаунт ${u.email}?`)) {
                            setRemovedIds((ids) => [...ids, u.id]);
                          }
                        }}
                        className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
