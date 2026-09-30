"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Status {
  connected: boolean;
  counterId?: string | null;
  counterName?: string | null;
  leadsGoalId?: string | null;
  salesGoalId?: string | null;
}

interface Counter {
  id: string;
  name: string;
  site: string;
}

interface Goal {
  id: string;
  name: string;
}

interface MetrikaConnectProps {
  businessId: string;
  onAutofill: (data: { visitors: number; leads: number | null; sales: number | null }) => void;
}

export default function MetrikaConnect(props: MetrikaConnectProps) {
  return (
    <Suspense fallback={null}>
      <MetrikaConnectInner {...props} />
    </Suspense>
  );
}

function MetrikaConnectInner({ businessId, onAutofill }: MetrikaConnectProps) {
  const searchParams = useSearchParams();
  const callbackStatus = searchParams.get("metrika"); // "connected" | "error" | null

  const [status, setStatus] = useState<Status | null>(null);
  const [counters, setCounters] = useState<Counter[] | null>(null);
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [showGoals, setShowGoals] = useState(false);
  const [goalForm, setGoalForm] = useState({ leads: "", sales: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    callbackStatus === "connected"
      ? "Метрика подключена — выберите счётчик."
      : callbackStatus === "error"
      ? "Не удалось подключить Метрику, попробуйте ещё раз."
      : null
  );

  const loadStatus = () => {
    fetch(`/api/metrika/status?businessId=${businessId}`)
      .then((res) => res.json())
      .then((data) => {
        setStatus(data);
        setGoalForm({ leads: data.leadsGoalId ?? "", sales: data.salesGoalId ?? "" });
      })
      .catch(() => setError("Не удалось проверить подключение к Метрике"));
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    if (status?.connected && !status.counterId && counters === null) {
      setLoading(true);
      fetch(`/api/metrika/counters?businessId=${businessId}`)
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setCounters(data.counters);
        })
        .catch((e) => setError(String(e.message || e)))
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const chooseCounter = async (counter: Counter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/metrika/counter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, counterId: counter.id, counterName: counter.name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error);
      setNotice(null);
      loadStatus();
    } catch (e) {
      setError(String((e as Error).message || e) || "Не удалось выбрать счётчик");
    } finally {
      setLoading(false);
    }
  };

  const loadGoals = () => {
    setShowGoals(true);
    if (goals !== null) return;
    setLoading(true);
    fetch(`/api/metrika/goals?businessId=${businessId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setGoals(data.goals);
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  };

  const saveGoals = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/metrika/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          leadsGoalId: goalForm.leads || null,
          salesGoalId: goalForm.sales || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error);
      loadStatus();
      setShowGoals(false);
    } catch (e) {
      setError(String((e as Error).message || e) || "Не удалось сохранить цели");
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Отключить Яндекс Метрику от этого бизнеса?")) return;
    setLoading(true);
    try {
      await fetch("/api/metrika/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      setCounters(null);
      setGoals(null);
      loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const pullData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/metrika/data?businessId=${businessId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAutofill({ visitors: data.visitors, leads: data.leads, sales: data.sales });
      setNotice("Данные из Метрики подставлены в форму ниже — проверьте и сохраните.");
    } catch (e) {
      setError(String((e as Error).message || e) || "Не удалось получить данные из Метрики");
    } finally {
      setLoading(false);
    }
  };

  if (!status) return null;

  return (
    <div className="mb-5 rounded-xl border border-line bg-soft p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-900">Яндекс Метрика</p>
        {status.connected && (
          <button onClick={disconnect} className="text-xs text-muted underline underline-offset-4 hover:text-ink-900">
            Отключить
          </button>
        )}
      </div>

      {notice && <p className="mb-2 text-sm text-violet">{notice}</p>}
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      {!status.connected && (
        <>
          <p className="mb-3 text-sm text-muted">
            Подключите свой счётчик Метрики — «Обращения» будут подставляться в форму ниже
            автоматически, вместо ручного ввода.
          </p>
          <a
            href={`/api/metrika/connect?businessId=${businessId}`}
            className="inline-block rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-ink-800"
          >
            Подключить Яндекс Метрику
          </a>
        </>
      )}

      {status.connected && !status.counterId && (
        <>
          <p className="mb-3 text-sm text-muted">Выберите счётчик, который относится к этому бизнесу:</p>
          {loading && !counters && <p className="text-sm text-muted">Загружаем список счётчиков…</p>}
          {counters && counters.length === 0 && (
            <p className="text-sm text-muted">
              На этом аккаунте Яндекса не нашлось ни одного счётчика Метрики.
            </p>
          )}
          {counters && counters.length > 0 && (
            <div className="grid gap-2">
              {counters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => chooseCounter(c)}
                  disabled={loading}
                  className="rounded-xl border border-line bg-white p-3 text-left text-sm transition-colors hover:border-violet disabled:opacity-50"
                >
                  <span className="block font-medium text-ink-900">{c.name}</span>
                  <span className="block text-muted">{c.site}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {status.connected && status.counterId && (
        <>
          <p className="mb-3 text-sm text-muted">
            Счётчик: <b className="text-ink-900">{status.counterName ?? status.counterId}</b>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={pullData}
              disabled={loading}
              className="rounded-full bg-brand px-4 py-2 text-sm font-extrabold text-ink-900 transition hover:-translate-y-0.5 hover:bg-brand/90 disabled:opacity-50"
            >
              Подставить данные за этот месяц
            </button>
            <button
              onClick={showGoals ? () => setShowGoals(false) : loadGoals}
              disabled={loading}
              className="rounded-full border border-ink-900/20 px-4 py-2 text-sm font-medium text-ink-900 transition hover:-translate-y-0.5 hover:bg-ink-900 hover:text-white disabled:opacity-50"
            >
              {status.leadsGoalId || status.salesGoalId ? "Изменить цели" : "Настроить цели"}
            </button>
          </div>

          {showGoals && (
            <div className="mt-3 grid gap-3 rounded-xl border border-line bg-white p-3 sm:grid-cols-2">
              {goals === null && <p className="text-sm text-muted sm:col-span-2">Загружаем цели…</p>}
              {goals && goals.length === 0 && (
                <p className="text-sm text-muted sm:col-span-2">
                  У этого счётчика в Метрике не настроено ни одной цели — заявки и продажи
                  подтянуть не получится, только обращения (визиты).
                </p>
              )}
              {goals && goals.length > 0 && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm text-muted">Цель «Заявка»</label>
                    <select
                      value={goalForm.leads}
                      onChange={(e) => setGoalForm({ ...goalForm, leads: e.target.value })}
                      className="w-full rounded-xl border border-line bg-white p-2.5 text-sm text-ink-900 outline-none focus:border-violet"
                    >
                      <option value="">Не сопоставлено</option>
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm text-muted">Цель «Продажа»</label>
                    <select
                      value={goalForm.sales}
                      onChange={(e) => setGoalForm({ ...goalForm, sales: e.target.value })}
                      className="w-full rounded-xl border border-line bg-white p-2.5 text-sm text-ink-900 outline-none focus:border-violet"
                    >
                      <option value="">Не сопоставлено</option>
                      {goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      onClick={saveGoals}
                      disabled={loading}
                      className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-800 disabled:opacity-50"
                    >
                      Сохранить цели
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
