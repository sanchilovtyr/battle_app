"use client";

import { useEffect, useState } from "react";

interface Promo {
  id: string;
  code: string;
  percent: number;
  active: boolean;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  note: string;
  createdAt: string;
}
interface State {
  promos: Promo[];
  suggested?: string;
  needsDbPush?: boolean;
  notice?: string;
  error?: string;
}

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-900 focus:outline-none";

const fmtDate = (iso: string | null) => {
  if (!iso) return "без срока";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Moscow" });
};

export default function AdminPromoTab() {
  const [st, setSt] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("50");
  const [expires, setExpires] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch("/api/admin/promo")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: State) => {
        setSt(d);
        if (d.suggested) setCode(d.suggested);
      })
      .catch(() => setSt({ promos: [] }));
  }, []);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/promo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as State;
      if (!res.ok) setMsg(data.error || "Не удалось выполнить действие");
      else {
        setSt(data);
        setMsg(data.notice || "");
        if (body.action === "create") {
          setCode(data.suggested || "");
          setNote("");
          setMaxUses("");
          setExpires("");
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
        <h2 className="font-display text-lg text-ink-900">Промокоды на «Премиум»</h2>
        <p className="mt-1 text-sm text-muted">
          Скидка действует на первый месяц и только для пользователей на бесплатном тарифе. Со второго месяца подписка продлевается по обычной цене (если не отменить). Скидка 100% даёт месяц без оплаты и без автопродления. Один пользователь может использовать один код один раз.
        </p>
        {st?.needsDbPush && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Таблицы промокодов не найдены. Выполните на сервере npx prisma db push.</p>}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Промокод</span>
            <div className="flex gap-1">
              <input className={inputCls} value={code} maxLength={32} onChange={(e) => setCode(e.target.value)} />
              <button type="button" onClick={() => setCode(st?.suggested ?? "")} className="shrink-0 rounded-xl border border-line px-3 text-xs hover:bg-soft" title="Подставить случайный код">
                Случайный
              </button>
            </div>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Скидка, %</span>
            <input className={inputCls} inputMode="numeric" value={percent} onChange={(e) => setPercent(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Действует до (необязательно)</span>
            <input type="date" className={inputCls} value={expires} onChange={(e) => setExpires(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted">Сколько раз можно (необязательно)</span>
            <input className={inputCls} inputMode="numeric" value={maxUses} placeholder="без лимита" onChange={(e) => setMaxUses(e.target.value)} />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-xs text-muted">Заметка для себя (кому выдан, зачем)</span>
          <input className={inputCls} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
        </label>
        <button
          disabled={busy || !code.trim()}
          onClick={() => act({ action: "create", code, percent: Number(percent), expiresAt: expires || null, maxUses: maxUses.trim() ? Number(maxUses) : null, note })}
          className="mt-4 rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-40"
        >
          Создать промокод
        </button>
        {msg && <p className="mt-2 text-sm text-ink-900/80">{msg}</p>}
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h3 className="font-display text-base text-ink-900">Все промокоды {st ? `(${st.promos.length})` : ""}</h3>
        {st && st.promos.length === 0 && <p className="mt-2 text-sm text-muted">Пока нет ни одного промокода.</p>}
        {st && st.promos.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
            {st.promos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">
                    <span className="font-mono">{p.code}</span> · {p.percent}%{" "}
                    {!p.active && <span className="text-xs font-normal text-muted">(выключен)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    Использован: {p.usedCount}
                    {p.maxUses !== null ? ` из ${p.maxUses}` : ""} · срок: {fmtDate(p.expiresAt)}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <div className="flex gap-3 text-xs">
                  <button disabled={busy} onClick={() => act({ action: "toggle", id: p.id, active: !p.active })} className="text-violet underline underline-offset-4">
                    {p.active ? "Выключить" : "Включить"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(p.usedCount > 0 ? "Код уже использовали: он будет выключен, но останется в списке. Продолжить?" : "Удалить промокод?")) void act({ action: "remove", id: p.id });
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
      </section>
    </div>
  );
}
