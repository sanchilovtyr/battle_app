"use client";

import { useEffect, useMemo, useState } from "react";
import { RISK_CATEGORIES, RISK_CATEGORY_LABELS, REVIEW_PERIODS, REVIEW_PERIOD_LABELS, type RiskCategory } from "@/lib/risksCore";
import type { LibraryEntry } from "@/lib/riskLibrary";

interface State {
  templates: LibraryEntry[];
  typeLabels: Record<string, string>;
  needsDbPush?: boolean;
  error?: string;
}

interface Draft {
  id: string;
  title: string;
  category: RiskCategory;
  what: string;
  signal: string;
  measures: string;
  plan: string;
  probability: number;
  impact: number;
  every: number;
  keywords: string;
  types: string[];
  builtin: boolean;
}

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-900 focus:outline-none";

const emptyDraft = (): Draft => ({ id: "", title: "", category: "legal", what: "", signal: "", measures: "", plan: "", probability: 3, impact: 3, every: 30, keywords: "", types: [], builtin: false });
const toDraft = (e: LibraryEntry): Draft => ({
  id: e.id, title: e.title, category: e.category, what: e.what, signal: e.signal, measures: e.measures, plan: e.plan,
  probability: e.probability, impact: e.impact, every: e.every, keywords: e.keywords ?? "", types: e.types, builtin: e.builtin,
});

function Editor({ draft, typeLabels, busy, onSave, onCancel }: { draft: Draft; typeLabels: Record<string, string>; busy: boolean; onSave: (d: Draft) => void; onCancel: () => void }) {
  const [d, setD] = useState<Draft>(draft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const text = (k: "what" | "signal" | "measures" | "plan", label: string, rows: number, max: number) => (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <textarea className={inputCls} rows={rows} maxLength={max} value={d[k]} onChange={(e) => set(k, e.target.value)} />
    </label>
  );
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-soft p-4">
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Название угрозы</span>
        <input className={inputCls} value={d.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">Категория</span>
          <select className={inputCls} value={d.category} onChange={(e) => set("category", e.target.value as RiskCategory)}>
            {RISK_CATEGORIES.map((c) => (
              <option key={c} value={c}>{RISK_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">Вероятность (1–5)</span>
          <select className={inputCls} value={d.probability} onChange={(e) => set("probability", Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">Влияние (1–5)</span>
          <select className={inputCls} value={d.impact} onChange={(e) => set("impact", Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted">Проверять</span>
          <select className={inputCls} value={d.every} onChange={(e) => set("every", Number(e.target.value))}>
            {REVIEW_PERIODS.map((n) => <option key={n} value={n}>{REVIEW_PERIOD_LABELS[n] ?? `${n} дн.`}</option>)}
          </select>
        </label>
      </div>
      {text("what", "Что это значит для бизнеса (одним предложением)", 2, 400)}
      {text("signal", "За чем следить: где и по каким признакам заметить угрозу", 2, 600)}
      {text("measures", "Как подготовиться заранее", 3, 1500)}
      {text("plan", "План Б: что делать в первые дни, если угроза наступила", 3, 1500)}
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Ключевые слова для подбора новостей (через запятую; совпадение с началом слова)</span>
        <input className={inputCls} value={d.keywords} maxLength={300} placeholder="поставк, граница, таможн" onChange={(e) => set("keywords", e.target.value)} />
      </label>
      {!d.builtin && (
        <fieldset className="text-sm">
          <legend className="mb-1 text-xs text-muted">Для каких типов бизнеса показывать (ничего не отмечено — для всех)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(typeLabels).map(([k, label]) => (
              <label key={k} className="flex items-center gap-1.5">
                <input type="checkbox" checked={d.types.includes(k)} onChange={(e) => set("types", e.target.checked ? [...d.types, k] : d.types.filter((x) => x !== k))} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        <button disabled={busy || d.title.trim().length < 5} onClick={() => onSave(d)} className="rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-40">
          Сохранить
        </button>
        <button onClick={onCancel} className="rounded-full border border-line px-5 py-2 text-sm hover:bg-white">Отмена</button>
      </div>
    </div>
  );
}

export default function AdminRiskTemplatesTab() {
  const [st, setSt] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<string | null>(null); // id или "new"
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/admin/risk-templates")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setSt)
      .catch(() => setSt({ templates: [], typeLabels: {} }));
  }, []);

  const act = async (body: Record<string, unknown>): Promise<boolean> => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/risk-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as State;
      if (!res.ok) {
        setMsg(data.error || "Не удалось выполнить действие");
        return false;
      }
      setSt(data);
      return true;
    } catch {
      setMsg("Нет связи с сервером");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const list = useMemo(() => {
    const all = st?.templates ?? [];
    if (filter === "all") return all;
    if (filter === "custom") return all.filter((t) => !t.builtin);
    if (filter === "universal") return all.filter((t) => t.builtin && t.types.length === 0);
    return all.filter((t) => t.types.includes(filter));
  }, [st, filter]);

  const typeLabel = (t: LibraryEntry) => (t.types.length === 0 ? "Все типы бизнеса" : t.types.map((k) => st?.typeLabels[k] ?? k).join(", "));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-lg text-ink-900">Типовые угрозы для «Управления рисками»</h2>
        <p className="mt-1 text-sm text-muted">
          Это библиотека, из которой пользователи «Премиума» выбирают угрозы в свой реестр. Пользователь не может её менять: только вы. Правки видны сразу всем, но уже добавленные в реестры угрозы не меняются: у каждого пользователя остаётся его копия. Скрытая угроза пропадает из выбора. Свою угрозу можно добавить для всех или для отдельных типов бизнеса.
        </p>
        {st?.needsDbPush && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Таблица библиотеки не найдена: сохранить правки нельзя. Выполните на сервере npx prisma db push.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select className="rounded-xl border border-line bg-white px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Показать">
            <option value="all">Все угрозы</option>
            <option value="universal">Для всех типов (встроенные)</option>
            {Object.entries(st?.typeLabels ?? {}).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            <option value="custom">Добавленные мной</option>
          </select>
          <button onClick={() => setEditing("new")} className="rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-white hover:bg-ink-800">Добавить угрозу</button>
          <span className="text-xs text-muted">Всего: {st?.templates.length ?? 0}</span>
        </div>
        {msg && <p className="mt-2 text-sm text-red-700">{msg}</p>}
        {editing === "new" && st && (
          <Editor draft={emptyDraft()} typeLabels={st.typeLabels} busy={busy} onCancel={() => setEditing(null)} onSave={async (d) => { if (await act({ action: "save", ...d, id: "" })) setEditing(null); }} />
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        {list.length === 0 && <p className="text-sm text-muted">Здесь пока ничего нет.</p>}
        <ul className="divide-y divide-line">
          {list.map((t) => (
            <li key={t.id} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${t.hidden ? "text-muted line-through" : "text-ink-900"}`}>{t.title}</p>
                  <p className="text-xs text-muted">
                    {RISK_CATEGORY_LABELS[t.category]} · {typeLabel(t)} · {t.probability}×{t.impact}
                    {t.edited && " · изменена вами"}
                    {!t.builtin && " · ваша"}
                    {t.hidden && " · скрыта"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <button disabled={busy} onClick={() => setEditing(editing === t.id ? null : t.id)} className="text-violet underline underline-offset-4">Изменить</button>
                  <button disabled={busy} onClick={() => act({ action: "hide", id: t.id, hidden: !t.hidden })} className="text-violet underline underline-offset-4">{t.hidden ? "Показать" : "Скрыть"}</button>
                  {t.edited && (
                    <button disabled={busy} onClick={() => window.confirm("Вернуть исходный текст этой угрозы?") && act({ action: "reset", id: t.id })} className="text-muted underline underline-offset-4">Вернуть исходный</button>
                  )}
                  {!t.builtin && (
                    <button disabled={busy} onClick={() => window.confirm("Удалить угрозу из библиотеки?") && act({ action: "remove", id: t.id })} className="text-muted underline underline-offset-4">Удалить</button>
                  )}
                </div>
              </div>
              {editing === t.id && st && (
                <Editor key={t.id} draft={toDraft(t)} typeLabels={st.typeLabels} busy={busy} onCancel={() => setEditing(null)} onSave={async (d) => { if (await act({ action: "save", ...d })) setEditing(null); }} />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
