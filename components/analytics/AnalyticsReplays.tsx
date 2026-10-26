"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

const ReplayPlayer = dynamic(() => import("./ReplayPlayer"), { ssr: false, loading: () => <p className="text-sm text-muted">Загрузка проигрывателя…</p> });

interface Row {
  id: string;
  startedAt: string;
  durationSec: number;
  pageViews: number;
  device: string;
  channel: string;
  source: string;
  campaign: string;
  landingPath: string;
  registered: boolean;
  kb: number;
}

const DEVICE: Record<string, string> = { desktop: "Компьютер", tablet: "Планшет", mobile: "Телефон" };
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const th = "whitespace-nowrap px-2 py-2 text-left text-xs font-medium text-muted";
const td = "px-2 py-2 align-top text-sm text-ink-900";

function Settings() {
  const [enabled, setEnabled] = useState(true);
  const [percent, setPercent] = useState(100);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/admin/analytics/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) {
          setEnabled(!!j.replayEnabled);
          setPercent(j.replayPercent);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save() {
    setState("saving");
    const r = await fetch("/api/admin/analytics/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ replayEnabled: enabled, replayPercent: percent }),
    }).catch(() => null);
    setState(r && r.ok ? "saved" : "error");
  }

  return (
    <section className="mb-6 rounded-2xl border border-line bg-white p-5">
      <h3 className="font-display text-base text-ink-900">Запись сессий</h3>
      <p className="mb-3 mt-1 text-xs text-muted">
        Пишутся только анонимные посетители на публичных страницах (главная, блог, о нас, страницы ниш, оферта и политика). Личный кабинет, оплата и вход не записываются. Всё, что человек вводит в поля, скрыто. Записи хранятся 30 дней, одна сессия — не дольше 8 минут.
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-ink-900">
          <input type="checkbox" checked={enabled} disabled={!loaded} onChange={(e) => setEnabled(e.target.checked)} />
          Записывать сессии
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-900">
          Доля сессий, %
          <input type="number" min={1} max={100} value={percent} disabled={!loaded} onChange={(e) => setPercent(Number(e.target.value))} className="w-20 rounded-lg border border-line px-2 py-1" />
        </label>
        <button onClick={save} disabled={!loaded || state === "saving"} className="rounded-full bg-ink-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40">
          Сохранить
        </button>
        {state === "saved" && <span className="text-sm text-green-700">Сохранено (действует в течение минуты)</span>}
        {state === "error" && <span className="text-sm text-red-700">Не удалось сохранить</span>}
      </div>
    </section>
  );
}

export default function AnalyticsReplays({ query }: { query: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Row | null>(null);
  const [events, setEvents] = useState<unknown[] | null>(null);
  const [evError, setEvError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    setError(null);
    fetch(`/api/admin/analytics/replays?${query}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Ошибка загрузки");
        return j;
      })
      .then((j) => alive && setRows(j.sessions))
      .catch((e) => alive && setError(String(e.message || e)));
    return () => {
      alive = false;
    };
  }, [query]);

  const show = useCallback(async (row: Row) => {
    setOpen(row);
    setEvents(null);
    setEvError(null);
    const r = await fetch(`/api/admin/analytics/replays/${row.id}`).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) setEvError(j?.error || "Не удалось загрузить запись");
    else setEvents(j.events);
  }, []);

  return (
    <div>
      <Settings />
      {open && (
        <section className="mb-6 rounded-2xl border border-line bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base text-ink-900">
              Сессия {fmtDate(open.startedAt)} · {DEVICE[open.device] || "—"} · {open.source}
            </h3>
            <button onClick={() => setOpen(null)} className="text-sm text-muted underline">
              Закрыть
            </button>
          </div>
          {evError && <p className="text-sm text-red-700">{evError}</p>}
          {!events && !evError && <p className="text-sm text-muted">Загрузка записи…</p>}
          {events && <ReplayPlayer events={events} />}
        </section>
      )}

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">{error}</div>}
      {!rows && !error && <p className="text-sm text-muted">Загрузка…</p>}
      {rows && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h3 className="mb-3 font-display text-base text-ink-900">Записи за период</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className={th}>Начало</th>
                  <th className={th}>Длительность</th>
                  <th className={th}>Страниц</th>
                  <th className={th}>Устройство</th>
                  <th className={th}>Источник</th>
                  <th className={th}>Вход</th>
                  <th className={th}>Итог</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className={td}>{fmtDate(r.startedAt)}</td>
                    <td className={td}>{fmtDur(r.durationSec)}</td>
                    <td className={td}>{r.pageViews}</td>
                    <td className={td}>{DEVICE[r.device] || "—"}</td>
                    <td className={td}>
                      {r.source}
                      {r.campaign && <div className="text-xs text-muted">{r.campaign}</div>}
                    </td>
                    <td className={td}>{r.landingPath}</td>
                    <td className={td}>{r.registered ? "Зарегистрировался" : "—"}</td>
                    <td className={td}>
                      <button onClick={() => show(r)} className="rounded-full border border-line px-3 py-1 text-sm hover:bg-soft">
                        Смотреть
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className={td} colSpan={8}>
                      За выбранный период записей нет. Они появятся, когда посетители начнут заходить после обновления сайта.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
