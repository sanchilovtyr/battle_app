"use client";

import { useEffect, useMemo, useState } from "react";
import KpiTile from "@/components/dashboard/KpiTile";
import { fmtNum } from "@/lib/dashboard";
import { FUNNEL_CHANNEL_LABELS, FunnelChannel } from "@/lib/funnel";
import { getClients, newClientId, saveClients } from "@/lib/crm";
import {
  CLIENT_STATUSES,
  CLIENT_STATUS_LABELS,
  CRM_SOURCES,
  ClientStatus,
  CrmClient,
  MAX_CLIENTS,
  clientsToCsv,
  computeCrmStats,
  withStatus,
} from "@/lib/crmCore";

interface Props {
  businessId: string;
  businessName: string;
  monthlyPlanPrice: number;
  /** меняется после синхронизации с сервером — тогда список перечитывается */
  syncTick: number;
}

const STATUS_TONE: Record<ClientStatus, string> = {
  new: "bg-soft text-ink-900",
  in_work: "bg-amber-50 text-amber-800",
  won: "bg-emerald-50 text-emerald-800",
  lost: "bg-red-50 text-red-800",
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

interface FormState {
  name: string;
  contact: string;
  source: FunnelChannel;
  viaService: boolean;
  status: ClientStatus;
  amount: string;
  date: string;
  note: string;
}

const emptyForm = (): FormState => ({
  name: "",
  contact: "",
  source: "yandex_direct",
  viaService: true,
  status: "new",
  amount: "",
  date: todayStr(),
  note: "",
});

function toForm(c: CrmClient): FormState {
  return {
    name: c.name,
    contact: c.contact,
    source: c.source,
    viaService: c.viaService,
    status: c.status,
    amount: c.amount ? String(c.amount) : "",
    date: c.createdAt.slice(0, 10),
    note: c.note ?? "",
  };
}

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-900 focus:outline-none";

function ClientForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormState;
  submitLabel: string;
  onSubmit: (f: FormState) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));
  const canSave = f.name.trim().length > 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSubmit(f);
      }}
      className="rounded-2xl border border-line bg-white p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Имя или название *</span>
          <input className={inputCls} value={f.name} maxLength={120} onChange={(e) => set("name", e.target.value)} autoFocus />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Контакт (телефон, Telegram, почта)</span>
          <input className={inputCls} value={f.contact} maxLength={120} onChange={(e) => set("contact", e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Откуда пришёл</span>
          <select className={inputCls} value={f.source} onChange={(e) => set("source", e.target.value as FunnelChannel)}>
            {CRM_SOURCES.map((s) => (
              <option key={s} value={s}>
                {FUNNEL_CHANNEL_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Дата обращения</span>
          <input type="date" className={inputCls} value={f.date} max={todayStr()} onChange={(e) => set("date", e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted">Статус</span>
          <select className={inputCls} value={f.status} onChange={(e) => set("status", e.target.value as ClientStatus)}>
            {CLIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CLIENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        {f.status !== "lost" && (
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted">{f.status === "won" ? "Сумма сделки, ₽" : "Сумма сделки (ожидаемая), ₽"}</span>
            <input
              className={inputCls}
              inputMode="numeric"
              value={f.amount}
              onChange={(e) => set("amount", e.target.value.replace(/[^\d]/g, "").slice(0, 9))}
            />
          </label>
        )}
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs text-muted">Заметка</span>
          <input className={inputCls} value={f.note} maxLength={500} onChange={(e) => set("note", e.target.value)} />
        </label>
      </div>
      <label className="mt-3 flex items-start gap-2 text-sm text-ink-900">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={f.viaService} onChange={(e) => set("viaService", e.target.checked)} />
        <span>
          Пришёл благодаря нашему плану
          <span className="block text-xs text-muted">Из таких клиентов считается эффективность сервиса.</span>
        </span>
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!canSave}
          className="rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-800 disabled:opacity-40"
        >
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-line px-5 py-2 text-sm text-ink-900/75 hover:bg-soft">
          Отмена
        </button>
      </div>
    </form>
  );
}

/** Лёгкая CRM: клиенты, статусы, источники и эффективность сервиса. */
export default function ClientsCrm({ businessId, businessName, monthlyPlanPrice, syncTick }: Props) {
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [filter, setFilter] = useState<"all" | ClientStatus>("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  useEffect(() => {
    setClients(getClients(businessId));
  }, [businessId, syncTick]);

  const persist = (next: CrmClient[]) => setClients(saveClients(businessId, next));
  const stats = useMemo(() => computeCrmStats(clients, new Date(), monthlyPlanPrice), [clients, monthlyPlanPrice]);
  const visible = useMemo(() => (filter === "all" ? clients : clients.filter((c) => c.status === filter)), [clients, filter]);

  const fromForm = (f: FormState, base?: CrmClient): CrmClient => {
    const nowIso = new Date().toISOString();
    const created = f.date ? new Date(`${f.date}T12:00:00`).toISOString() : nowIso;
    let c: CrmClient = {
      id: base?.id ?? newClientId(),
      createdAt: base && f.date === base.createdAt.slice(0, 10) ? base.createdAt : created,
      updatedAt: nowIso,
      name: f.name.trim().slice(0, 120),
      contact: f.contact.trim().slice(0, 120),
      source: f.source,
      viaService: f.viaService,
      status: base?.status ?? "new",
      ...(f.note.trim() ? { note: f.note.trim().slice(0, 500) } : {}),
      ...(base?.closedAt ? { closedAt: base.closedAt } : {}),
    };
    c = withStatus(c, f.status, nowIso);
    if (f.status !== "lost" && f.amount) c.amount = Number(f.amount);
    return c;
  };

  const add = (f: FormState) => {
    persist([fromForm(f), ...clients]);
    setAdding(false);
  };
  const edit = (id: string, f: FormState) => {
    persist(clients.map((c) => (c.id === id ? fromForm(f, c) : c)));
    setEditing(null);
  };
  const changeStatus = (id: string, status: ClientStatus) =>
    persist(clients.map((c) => (c.id === id ? withStatus(c, status, new Date().toISOString()) : c)));
  const remove = (id: string) => {
    persist(clients.filter((c) => c.id !== id));
    setConfirmDel(null);
  };

  const downloadCsv = () => {
    try {
      const blob = new Blob([clientsToCsv(clients, FUNNEL_CHANNEL_LABELS)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `klienty-${todayStr()}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // не критично
    }
  };

  const svc = stats.service;
  const full = clients.length >= MAX_CLIENTS;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink-900 sm:text-3xl">Клиенты (CRM)</h1>
        <p className="mt-1 text-sm text-muted">
          «{businessName}»: записывайте, кто обратился, чем закончилось и сколько заплатил. Здесь видно, сколько клиентов и денег принёс план.
        </p>
      </header>

      <section aria-label="Итоги" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Клиентов всего" value={fmtNum(stats.total)} hint={stats.active ? `в работе: ${stats.active}${stats.pipeline ? ` на ${fmtNum(stats.pipeline)} ₽` : ""}` : ""} />
        <KpiTile label="Оплатили" value={fmtNum(stats.won)} hint={stats.lost ? `не купили: ${stats.lost}` : ""} />
        <KpiTile label="Выручка" value={fmtNum(stats.revenue)} unit="₽" hint={stats.avgCheck ? `средний чек ${fmtNum(stats.avgCheck)} ₽` : ""} />
        <KpiTile label="Конверсия в оплату" value={fmtNum(stats.conversion, 1)} unit="%" hint="доля оплативших" />
      </section>

      <section aria-labelledby="crm-eff" className="mb-6 rounded-2xl border border-line bg-white p-5">
        <h2 id="crm-eff" className="font-display text-base text-ink-900">
          Эффективность сервиса
        </h2>
        <p className="mt-0.5 text-xs text-muted">Считаются клиенты с отметкой «Пришёл благодаря нашему плану».</p>
        {svc.total === 0 ? (
          <p className="mt-3 rounded-xl bg-soft p-3 text-sm text-muted">
            Добавьте клиента и оставьте отметку «Пришёл благодаря нашему плану» — здесь появится, сколько клиентов и выручки он дал.
          </p>
        ) : (
          <>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-soft p-3">
                <dt className="text-xs text-muted">Клиентов от сервиса</dt>
                <dd className="mt-0.5 font-medium text-ink-900">
                  {fmtNum(svc.total)}, оплатили {fmtNum(svc.won)}
                </dd>
              </div>
              <div className="rounded-xl bg-soft p-3">
                <dt className="text-xs text-muted">Выручка от них, всего</dt>
                <dd className="mt-0.5 font-medium text-ink-900">{fmtNum(svc.revenue)} ₽</dd>
              </div>
              <div className="rounded-xl bg-soft p-3">
                <dt className="text-xs text-muted">За этот месяц</dt>
                <dd className="mt-0.5 font-medium text-ink-900">
                  {fmtNum(svc.monthRevenue)} ₽, оплат: {fmtNum(svc.monthWon)}
                </dd>
              </div>
            </dl>
            {stats.paybackMonth !== null && monthlyPlanPrice > 0 && (
              <p className="mt-3 text-sm font-medium text-emerald-700">
                За этот месяц клиенты сервиса принесли {fmtNum(stats.paybackMonth, 1)}× от цены вашего тарифа ({fmtNum(monthlyPlanPrice)} ₽ в месяц).
              </p>
            )}
            <p className="mt-2 text-xs text-muted">Это ваши записи, а не гарантия результата: учитывайте и другие каналы, которые работали параллельно.</p>
          </>
        )}
      </section>

      {stats.bySource.length > 0 && (
        <section aria-labelledby="crm-src" className="mb-6 rounded-2xl border border-line bg-white p-5">
          <h2 id="crm-src" className="font-display text-base text-ink-900">
            Откуда приходят клиенты
          </h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {stats.bySource.map((r) => (
              <li key={r.source} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
                <span className="text-ink-900">{FUNNEL_CHANNEL_LABELS[r.source]}</span>
                <span className="text-muted">
                  {r.total} клиент., оплатили {r.won}
                  {r.revenue > 0 && ` · ${fmtNum(r.revenue)} ₽`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="crm-list">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="crm-list" className="font-display text-lg text-ink-900">
            Клиенты
          </h2>
          <div className="flex flex-wrap gap-2">
            {clients.length > 0 && (
              <button onClick={downloadCsv} className="rounded-full border border-line px-4 py-2 text-sm text-ink-900/75 hover:bg-soft">
                Скачать CSV
              </button>
            )}
            {!adding && (
              <button
                onClick={() => {
                  setAdding(true);
                  setEditing(null);
                }}
                disabled={full}
                className="rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-800 disabled:opacity-40"
              >
                ＋ Добавить клиента
              </button>
            )}
          </div>
        </div>

        {full && <p className="mb-3 text-xs text-muted">В списке максимум {MAX_CLIENTS} клиентов. Скачайте CSV и удалите старые записи.</p>}

        {adding && (
          <div className="mb-4">
            <ClientForm initial={emptyForm()} submitLabel="Сохранить" onSubmit={add} onCancel={() => setAdding(false)} />
          </div>
        )}

        {clients.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Фильтр по статусу">
            {(["all", ...CLIENT_STATUSES] as const).map((s) => {
              const active = filter === s;
              const count = s === "all" ? clients.length : clients.filter((c) => c.status === s).length;
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  aria-pressed={active}
                  className={`rounded-full border px-3.5 py-1.5 text-sm ${
                    active ? "border-ink-900 bg-ink-900 font-semibold text-white" : "border-line text-ink-900/75 hover:bg-soft"
                  }`}
                >
                  {s === "all" ? "Все" : CLIENT_STATUS_LABELS[s]} · {count}
                </button>
              );
            })}
          </div>
        )}

        {clients.length === 0 && !adding && (
          <div className="rounded-2xl border border-dashed border-line p-6 text-center">
            <p className="text-sm text-ink-900">Пока нет ни одного клиента.</p>
            <p className="mt-1 text-sm text-muted">
              Добавьте первого — кто обратился, откуда пришёл и чем закончилось. Дальше сервис сам покажет выручку, конверсию и источники.
            </p>
          </div>
        )}

        <ul className="space-y-3">
          {visible.map((c) =>
            editing === c.id ? (
              <li key={c.id}>
                <ClientForm initial={toForm(c)} submitLabel="Сохранить" onSubmit={(f) => edit(c.id, f)} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <li key={c.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-ink-900">{c.name}</p>
                    {c.contact && <p className="break-all text-sm text-muted">{c.contact}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                  <select
                    aria-label={`Статус клиента ${c.name}`}
                    value={c.status}
                    onChange={(e) => changeStatus(c.id, e.target.value as ClientStatus)}
                    className={`rounded-full border border-line px-3 py-1.5 text-sm font-medium ${STATUS_TONE[c.status]}`}
                  >
                    {CLIENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {CLIENT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  {c.status !== "lost" && (
                    <p
                      className={`text-right text-sm font-semibold ${
                        c.status === "won" ? "text-emerald-700" : c.amount ? "text-ink-900" : "text-muted"
                      }`}
                    >
                      {c.amount ? `${fmtNum(c.amount)} ₽` : c.status === "won" ? "сумма не указана" : "сумма не указана"}
                      {c.amount && c.status !== "won" && <span className="block text-xs font-normal text-muted">ожидается</span>}
                    </p>
                  )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted">
                  {fmtDate(c.createdAt)} · {FUNNEL_CHANNEL_LABELS[c.source]}
                  {c.viaService && " · от сервиса"}
                </p>
                {c.note && <p className="mt-1.5 break-words text-sm text-ink-900/80">{c.note}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <button
                    onClick={() => {
                      setEditing(c.id);
                      setAdding(false);
                    }}
                    className="text-violet underline underline-offset-4 hover:text-ink-900"
                  >
                    Изменить
                  </button>
                  {confirmDel === c.id ? (
                    <span className="flex items-center gap-3">
                      <button onClick={() => remove(c.id)} className="font-medium text-red-700 underline underline-offset-4">
                        Удалить насовсем
                      </button>
                      <button onClick={() => setConfirmDel(null)} className="text-muted underline underline-offset-4">
                        Отмена
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDel(c.id)} className="text-muted underline underline-offset-4 hover:text-ink-900">
                      Удалить
                    </button>
                  )}
                </div>
              </li>
            )
          )}
        </ul>
        {clients.length > 0 && visible.length === 0 && <p className="text-sm text-muted">В этом статусе клиентов нет.</p>}
      </section>
    </div>
  );
}
