"use client";

import { useCallback, useEffect, useState } from "react";

interface CompetitorInfo {
  id: string;
  name: string;
  url: string;
  lastCheckedAt: string | null;
  status: string;
  error: string;
  hasBaseline: boolean;
}
interface ChangeInfo {
  id: string;
  competitorId: string;
  detectedAt: string;
  added: string[];
  removed: string[];
  large: boolean;
  seen: boolean;
}
interface State {
  competitors: CompetitorInfo[];
  changes: ChangeInfo[];
  limit: number;
  notSynced?: boolean;
  needsDbPush?: boolean;
  notice?: string;
}

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-900 focus:outline-none";

const fmtDateTime = (iso: string | null): string => {
  if (!iso) return "ещё не проверялась";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export default function CompetitorWatch({
  businessId,
  syncTick,
  hasCompetitorRisk,
  onAddRisk,
}: {
  businessId: string;
  syncTick: number;
  hasCompetitorRisk: boolean;
  onAddRisk: () => void;
}) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/risks/competitors?businessId=${encodeURIComponent(businessId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setState((await res.json()) as State);
    } catch {
      setState({ competitors: [], changes: [], limit: 3, notice: "Не удалось загрузить данные. Обновите страницу." });
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load, syncTick]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/risks/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as State & { error?: string };
      if (!res.ok) {
        setError(data.error || "Не удалось выполнить действие");
      } else {
        setState(data);
        if (body.action === "add") {
          setName("");
          setUrl("");
        }
      }
    } catch {
      setError("Нет связи с сервером. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  const unseen = state?.changes.filter((c) => !c.seen) ?? [];
  const nameOf = (id: string) => state?.competitors.find((c) => c.id === id)?.name ?? "Конкурент";
  const full = !!state && state.competitors.length >= state.limit;

  return (
    <section aria-labelledby="rk-comp" className="mb-6 rounded-2xl border border-line bg-white p-5">
      <h2 id="rk-comp" className="font-display text-base text-ink-900">
        Что меняют конкуренты на своих сайтах
      </h2>
      <p className="mt-0.5 text-xs text-muted">
        Укажите страницу конкурента с ценами или предложением. Раз в сутки сервис сверяет её с прежней версией и показывает, что изменилось: новая цена, акция, услуга. До {state?.limit ?? 3} страниц. Сервис не заходит на сайты, которые запретили автоматические проверки.
      </p>

      {state?.notSynced && (
        <p className="mt-3 rounded-xl bg-soft p-4 text-sm text-ink-900/80">Бизнес ещё не сохранён на сервере. Обновите страницу через минуту, и эта функция станет доступна.</p>
      )}
      {state?.needsDbPush && (
        <p className="mt-3 rounded-xl bg-soft p-4 text-sm text-ink-900/80">Эта функция временно недоступна: сервис обновляется. Попробуйте позже.</p>
      )}
      {state?.notice && <p className="mt-3 text-sm text-amber-800">{state.notice}</p>}

      {unseen.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4" role="status">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink-900">Есть изменения на сайтах конкурентов</p>
            <button onClick={() => act({ action: "seen", ids: unseen.map((c) => c.id) })} disabled={busy} className="text-sm text-violet underline underline-offset-4 hover:text-ink-900">
              Отметить просмотренным
            </button>
          </div>
          <ul className="mt-2 space-y-3">
            {unseen.map((c) => (
              <li key={c.id} className="text-sm text-ink-900/85">
                <p className="font-medium text-ink-900">
                  {nameOf(c.competitorId)} <span className="text-xs font-normal text-muted">{fmtDateTime(c.detectedAt)}</span>
                </p>
                {c.large && <p className="text-xs text-amber-800">Страница изменилась почти целиком: возможно, это редизайн или другая страница.</p>}
                {c.added.length > 0 && (
                  <div className="mt-1">
                    <p className="text-xs text-muted">Появилось:</p>
                    <ul className="list-disc pl-5">
                      {c.added.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {c.removed.length > 0 && (
                  <div className="mt-1">
                    <p className="text-xs text-muted">Пропало:</p>
                    <ul className="list-disc pl-5 text-ink-900/65">
                      {c.removed.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Мы показываем различия в тексте страницы, а выводы делаете вы: откройте сайт и посмотрите, что изменилось на самом деле.</p>
          {!hasCompetitorRisk && (
            <button onClick={onAddRisk} className="mt-2 rounded-full bg-ink-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-ink-800">
              Добавить угрозу «Конкурент добавил новое УТП» в реестр
            </button>
          )}
        </div>
      )}

      {state && state.competitors.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {state.competitors.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink-900">{c.name}</p>
                <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-xs text-violet underline underline-offset-4">
                  {c.url}
                </a>
                <p className={`mt-0.5 text-xs ${c.status === "ok" ? "text-muted" : "text-amber-800"}`}>
                  {c.status === "ok" ? `Проверено: ${fmtDateTime(c.lastCheckedAt)}` : c.error || (c.lastCheckedAt ? "Не удалось проверить" : "Ждёт первой проверки")}
                </p>
              </div>
              <button
                onClick={() => {
                  if (window.confirm("Перестать следить за этой страницей?")) void act({ action: "remove", id: c.id });
                }}
                disabled={busy}
                className="text-xs text-muted underline underline-offset-4 hover:text-ink-900"
              >
                Убрать
              </button>
            </li>
          ))}
        </ul>
      )}

      {state && !state.notSynced && !state.needsDbPush && (
        <div className="mt-4">
          {!full && (
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted">Название</span>
                <input className={inputCls} value={name} maxLength={80} placeholder="Например: Студия «Лотос»" onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs text-muted">Адрес страницы с предложением или ценами</span>
                <input className={inputCls} value={url} maxLength={500} placeholder="https://site.ru/price" inputMode="url" onChange={(e) => setUrl(e.target.value)} />
              </label>
              <button
                onClick={() => act({ action: "add", name, url })}
                disabled={busy || !url.trim()}
                className="rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-40"
              >
                {busy ? "Проверяем…" : "Добавить"}
              </button>
            </div>
          )}
          {full && <p className="text-xs text-muted">Добавлено максимум страниц ({state.limit}). Уберите одну, чтобы следить за другой.</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {state.competitors.length > 0 && (
              <button onClick={() => act({ action: "check" })} disabled={busy} className="text-sm text-violet underline underline-offset-4 hover:text-ink-900 disabled:opacity-40">
                Проверить сейчас
              </button>
            )}
            {state.competitors.length > 0 && unseen.length === 0 && <span className="text-xs text-muted">Изменений пока не замечено.</span>}
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
