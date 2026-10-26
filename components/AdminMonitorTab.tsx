"use client";

import { useEffect, useState } from "react";

interface Source {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastFetchedAt: string | null;
  lastStatus: string;
  lastError: string;
  lastItems: number;
}
interface State {
  sources: Source[];
  items: number;
  competitors: number;
  changes: number;
  needsDbPush?: boolean;
  run?: unknown;
  error?: string;
}

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-900 focus:outline-none";

const fmt = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export default function AdminMonitorTab() {
  const [st, setSt] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    fetch("/api/admin/monitor")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setSt)
      .catch(() => setSt({ sources: [], items: 0, competitors: 0, changes: 0 }));
  }, []);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg(body.action === "run" ? "Загружаем ленты и проверяем сайты…" : "");
    try {
      const res = await fetch("/api/admin/monitor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as State;
      if (!res.ok) setMsg(data.error || "Не удалось выполнить действие");
      else {
        setSt(data);
        setMsg(body.action === "run" ? `Готово: ${JSON.stringify(data.run)}` : "");
        if (body.action === "add") {
          setName("");
          setUrl("");
        }
      }
    } catch {
      setMsg("Нет связи с сервером");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-lg text-ink-900">Ленты новостей и законов</h2>
        <p className="mt-1 text-sm text-muted">
          Ленты RSS/Atom, из которых раздел «Управление рисками» подбирает публикации под угрозы пользователей. Читаются раз в сутки (вместе с SEO-монитором) и при кнопке ниже. Адрес проверяется при добавлении: если по нему нет ленты, она не сохранится. Подбирайте только официальные и надёжные источники.
        </p>
        <p className="mt-1 text-xs text-muted">
          Пример для проверки: РАПСИ, «Законодательство» — http://rapsinews.ru/export/rss2/legislation/index.xml (адрес не проверен автоматически: если лента не откроется, найдите актуальную на сайте издания).
        </p>
        {st?.needsDbPush && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Таблицы мониторинга не найдены. Выполните на сервере npx prisma db push.</p>}

        {st && st.sources.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
            {st.sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink-900">
                    {s.name} {!s.enabled && <span className="text-xs font-normal text-muted">(выключена)</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{s.url}</p>
                  <p className={`text-xs ${s.lastStatus === "error" ? "text-red-700" : "text-muted"}`}>
                    {s.lastStatus === "error" ? s.lastError : `Обновлено: ${fmt(s.lastFetchedAt)}, записей: ${s.lastItems}`}
                  </p>
                </div>
                <div className="flex gap-3 text-xs">
                  <button disabled={busy} onClick={() => act({ action: "toggle", id: s.id, enabled: !s.enabled })} className="text-violet underline underline-offset-4">
                    {s.enabled ? "Выключить" : "Включить"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Удалить ленту и её записи?")) void act({ action: "remove", id: s.id });
                    }}
                    className="text-muted underline underline-offset-4"
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Название</span>
            <input className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Адрес ленты</span>
            <input className={inputCls} value={url} maxLength={500} placeholder="https://…/rss.xml" onChange={(e) => setUrl(e.target.value)} />
          </label>
          <button disabled={busy || !url.trim()} onClick={() => act({ action: "add", name, url })} className="rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-40">
            Добавить
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <button disabled={busy} onClick={() => act({ action: "run" })} className="rounded-full border border-line px-5 py-2 hover:bg-soft disabled:opacity-40">
            Обновить сейчас
          </button>
          {st && (
            <span className="text-xs text-muted">
              Записей в базе: {st.items}. Страниц конкурентов под наблюдением: {st.competitors}. Найдено изменений: {st.changes}.
            </span>
          )}
        </div>
        {msg && <p className="mt-2 text-sm text-ink-900/80 break-words">{msg}</p>}
      </section>
    </div>
  );
}
