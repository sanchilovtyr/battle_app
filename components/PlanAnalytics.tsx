"use client";

import { useState } from "react";
import { GeneratedPlan } from "@/lib/types";
import { ChecklistState, phaseProgress, unfinishedSteps } from "@/lib/checklist";
import { FunnelSnapshot, addSnapshot, removeSnapshot } from "@/lib/funnel";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function defaultLabel() {
  const d = new Date();
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function pct(part: number, whole: number): number | null {
  if (!whole) return null;
  return Math.round((part / whole) * 1000) / 10;
}

interface Stage {
  key: "toLeads" | "toSales" | "toRepeat";
  label: string;
  from: string;
  to: string;
  value: number | null;
}

function buildStages(s: FunnelSnapshot): Stage[] {
  return [
    { key: "toLeads", label: "Обращения → заявки", from: "обращений", to: "заявку", value: pct(s.leads, s.visitors) },
    { key: "toSales", label: "Заявки → продажи", from: "заявок", to: "продажу", value: pct(s.sales, s.leads) },
    { key: "toRepeat", label: "Продажи → повторные", from: "продаж", to: "повторную покупку", value: pct(s.repeat, s.sales) },
  ];
}

function weakestStage(stages: Stage[]): Stage | null {
  const withValue = stages.filter((s) => s.value !== null);
  if (withValue.length === 0) return null;
  return withValue.reduce((min, s) => (s.value! < min.value! ? s : min), withValue[0]);
}

export function LockedAnalytics() {
  return (
    <div className="mb-8 rounded-2xl border border-dashed border-ink-900/20 bg-soft p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-brand">
        🔒
      </div>
      <h3 className="font-display text-lg text-ink-900 mb-1.5">Где вы теряете клиентов</h3>
      <p className="mx-auto mb-4 max-w-md text-sm text-muted">
        На тарифах «Бизнес» и «Команда» доступны чек-листы с отметками о выполнении и аналитика,
        которая по вашим цифрам и прогрессу плана показывает, на каком шаге воронки уходят клиенты.
      </p>
      <a
        href="/#pricing"
        className="inline-block rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-ink-800"
      >
        Посмотреть тарифы
      </a>
    </div>
  );
}

interface PlanAnalyticsProps {
  businessId: string;
  plan: GeneratedPlan;
  checklist: ChecklistState;
  snapshots: FunnelSnapshot[];
  onSnapshotsChange: (next: FunnelSnapshot[]) => void;
}

export default function PlanAnalytics({
  businessId,
  plan,
  checklist,
  snapshots,
  onSnapshotsChange,
}: PlanAnalyticsProps) {
  const [form, setForm] = useState({
    label: defaultLabel(),
    visitors: "",
    leads: "",
    sales: "",
    repeat: "",
  });
  const [showForm, setShowForm] = useState(snapshots.length === 0);

  const latest = snapshots.length ? snapshots[snapshots.length - 1] : null;
  const stages = latest ? buildStages(latest) : [];
  const weak = weakestStage(stages);

  const foundationProgress = phaseProgress(checklist, plan.foundation);
  const trafficProgress = phaseProgress(checklist, plan.traffic);
  const retentionProgress = phaseProgress(checklist, plan.retention);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const visitors = Math.max(0, Math.round(Number(form.visitors) || 0));
    const leads = Math.max(0, Math.round(Number(form.leads) || 0));
    const sales = Math.max(0, Math.round(Number(form.sales) || 0));
    const repeat = Math.max(0, Math.round(Number(form.repeat) || 0));
    const next = addSnapshot(businessId, { label: form.label.trim() || defaultLabel(), visitors, leads, sales, repeat });
    onSnapshotsChange(next);
    setForm({ label: defaultLabel(), visitors: "", leads: "", sales: "", repeat: "" });
    setShowForm(false);
  };

  const handleRemove = (id: string) => {
    onSnapshotsChange(removeSnapshot(businessId, id));
  };

  // Куда указывает найденное узкое место с точки зрения плана.
  let insight: { title: string; body: string; entries: typeof plan.foundation; progress: ReturnType<typeof phaseProgress> } | null = null;
  if (weak) {
    if (weak.key === "toLeads") {
      insight = {
        title: "Больше всего клиентов теряется на входе — обращения не превращаются в заявки",
        body: "Обычно это значит, что сайт или объявление не убеждают оставить контакт: непонятно предложение, нет цены или неудобно написать. Это зона этапа «Фундамент» вашего плана.",
        entries: plan.foundation,
        progress: foundationProgress,
      };
    } else if (weak.key === "toSales") {
      insight = {
        title: "Заявки есть, но до оплаты доходят немногие",
        body: "Это чаще вопрос скорости и качества обработки заявок, а не рекламы — план продвижения такое напрямую не решает. Но если клиенты «теряются» после первого контакта, CRM и рассылки из этапа «Удержание» помогают не забывать про тёплые заявки и доводить их до оплаты.",
        entries: plan.retention,
        progress: retentionProgress,
      };
    } else {
      insight = {
        title: "Клиенты покупают один раз и не возвращаются",
        body: "Это зона этапа «Удержание»: без напоминаний, рассылок или программы лояльности повторные продажи не случаются сами собой.",
        entries: plan.retention,
        progress: retentionProgress,
      };
    }
  }

  const todo = insight ? unfinishedSteps(checklist, insight.entries, 3) : [];

  return (
    <section className="mb-8 rounded-2xl border border-line bg-white p-6">
      <h2 className="font-display text-lg text-ink-900 mb-1.5">Где вы теряете клиентов</h2>
      <p className="text-sm text-muted mb-5">
        Сервис не подключён к счётчикам вашего сайта или CRM — эти цифры вы вносите сами, раз в
        период. По ним и по выполненным пунктам плана мы покажем, на каком шаге воронки клиенты
        отваливаются чаще всего.
      </p>

      {/* Прогресс по этапам плана — виден всегда, даже без данных воронки */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Фундамент", p: foundationProgress },
          { label: "Трафик", p: trafficProgress },
          { label: "Удержание", p: retentionProgress },
        ].map(({ label, p }) => (
          <div key={label} className="rounded-xl bg-soft p-3.5">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-ink-900">{label}</span>
              <span className="text-muted">{p.total ? `${p.done}/${p.total}` : "—"}</span>
            </div>
            <div className="h-1.5 rounded-full bg-line">
              <div className="h-1.5 rounded-full bg-violet transition-all" style={{ width: `${p.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {latest && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-ink-900">{latest.label}</p>
            <button
              onClick={() => handleRemove(latest.id)}
              className="text-xs text-muted underline underline-offset-4 hover:text-ink-900"
            >
              Удалить запись
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { label: "Обращения", value: latest.visitors },
              { label: "Заявки", value: latest.leads },
              { label: "Продажи", value: latest.sales },
              { label: "Повторные", value: latest.repeat },
            ].map((s, i) => (
              <div key={s.label} className="rounded-xl border border-line p-3">
                <p className="font-display text-xl text-ink-900">{s.value}</p>
                <p className="mt-0.5 text-xs text-muted">{s.label}</p>
                {i > 0 && stages[i - 1]?.value !== null && (
                  <p
                    className={`mt-1 text-xs font-medium ${
                      weak?.key === stages[i - 1].key ? "text-amber-700" : "text-muted"
                    }`}
                  >
                    {stages[i - 1].value}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {insight && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">{insight.title}</p>
          <p className="mt-1.5 text-sm text-amber-800">{insight.body}</p>
          {insight.progress.total > 0 && (
            <p className="mt-2 text-sm text-amber-800">
              Этот этап плана выполнен на {insight.progress.pct}% ({insight.progress.done} из{" "}
              {insight.progress.total} пунктов).
            </p>
          )}
          {todo.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-amber-900">Чтобы это исправить, доделайте:</p>
              <ul className="mt-1.5 space-y-1">
                {todo.map((t, i) => (
                  <li key={i} className="text-sm text-amber-800">
                    · {t.step}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {showForm ? (
        <form onSubmit={submit} className="rounded-xl border border-line bg-soft p-4">
          <div className="mb-3">
            <label className="mb-1.5 block text-sm text-muted">Период</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full rounded-xl border border-line bg-white p-3 text-ink-900 outline-none focus:border-violet"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { key: "visitors", label: "Обращения", hint: "Визиты на сайт, звонки, сообщения" },
              { key: "leads", label: "Заявки", hint: "Оставили контакт или спросили цену" },
              { key: "sales", label: "Продажи", hint: "Оплатили в первый раз" },
              { key: "repeat", label: "Повторные покупки", hint: "Из купивших — вернулись снова" },
            ].map((f) => (
              <div key={f.key}>
                <label className="mb-1.5 block text-sm text-muted">{f.label}</label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={(form as Record<string, string>)[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder="0"
                  className="w-full rounded-xl border border-line bg-white p-3 text-ink-900 outline-none focus:border-violet"
                />
                <p className="mt-1 text-xs text-muted">{f.hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-extrabold text-ink-900 transition hover:-translate-y-0.5 hover:bg-brand/90"
            >
              Сохранить показатели
            </button>
            {snapshots.length > 0 && (
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-muted underline underline-offset-4 hover:text-ink-900"
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-full border border-ink-900/20 px-5 py-2.5 text-sm font-medium text-ink-900 transition hover:-translate-y-0.5 hover:bg-ink-900 hover:text-white"
        >
          Внести показатели за новый период
        </button>
      )}
    </section>
  );
}
