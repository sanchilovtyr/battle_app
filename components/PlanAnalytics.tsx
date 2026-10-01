"use client";

import { useState } from "react";
import { GeneratedPlan } from "@/lib/types";
import { ChecklistState, phaseProgress, unfinishedSteps } from "@/lib/checklist";
import {
  DROP_REASON_LABELS,
  DropReason,
  FUNNEL_CHANNEL_LABELS,
  FunnelChannel,
  FunnelSnapshot,
  RESPONSE_SPEED_LABELS,
  ResponseSpeed,
  addSnapshot,
  removeSnapshot,
  streakMonths,
} from "@/lib/funnel";
import { getGrowthTarget, setGrowthTarget } from "@/lib/growthTarget";
import MetrikaConnect from "@/components/MetrikaConnect";

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

const EMPTY_FORM = {
  label: "",
  visitors: "",
  leads: "",
  sales: "",
  repeat: "",
  avgReceipt: "",
  adSpend: "",
  channel: "" as FunnelChannel | "",
  responseSpeed: "" as ResponseSpeed | "",
  dropReason: "" as DropReason | "",
  reviewsCount: "",
  reviewsRating: "",
};

export default function PlanAnalytics({
  businessId,
  plan,
  checklist,
  snapshots,
  onSnapshotsChange,
}: PlanAnalyticsProps) {
  const [form, setForm] = useState({ ...EMPTY_FORM, label: defaultLabel() });
  const [showForm, setShowForm] = useState(snapshots.length === 0);
  const [showExtra, setShowExtra] = useState(false);

  const [target, setTarget] = useState(() => getGrowthTarget(businessId));
  const [targetSaved, setTargetSaved] = useState(false);

  const latest = snapshots.length ? snapshots[snapshots.length - 1] : null;
  const stages = latest ? buildStages(latest) : [];
  const weak = weakestStage(stages);
  const streak = streakMonths(snapshots);

  const foundationProgress = phaseProgress(checklist, plan.foundation);
  const trafficProgress = phaseProgress(checklist, plan.traffic);
  const retentionProgress = phaseProgress(checklist, plan.retention);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const visitors = Math.max(0, Math.round(Number(form.visitors) || 0));
    const leads = Math.max(0, Math.round(Number(form.leads) || 0));
    const sales = Math.max(0, Math.round(Number(form.sales) || 0));
    const repeat = Math.max(0, Math.round(Number(form.repeat) || 0));
    const next = addSnapshot(businessId, {
      label: form.label.trim() || defaultLabel(),
      visitors,
      leads,
      sales,
      repeat,
      avgReceipt: form.avgReceipt ? Math.max(0, Number(form.avgReceipt)) : undefined,
      adSpend: form.adSpend ? Math.max(0, Number(form.adSpend)) : undefined,
      channel: form.channel || undefined,
      responseSpeed: form.responseSpeed || undefined,
      dropReason: form.dropReason || undefined,
      reviewsCount: form.reviewsCount ? Math.max(0, Math.round(Number(form.reviewsCount))) : undefined,
      reviewsRating: form.reviewsRating ? Math.max(0, Math.min(5, Number(form.reviewsRating))) : undefined,
    });
    onSnapshotsChange(next);
    setForm({ ...EMPTY_FORM, label: defaultLabel() });
    setShowForm(false);
    setShowExtra(false);
  };

  const handleRemove = (id: string) => {
    onSnapshotsChange(removeSnapshot(businessId, id));
  };

  const handleAutofill = (data: { visitors: number; leads: number | null; sales: number | null }) => {
    setForm((f) => ({
      ...f,
      visitors: String(data.visitors),
      leads: data.leads !== null ? String(data.leads) : f.leads,
      sales: data.sales !== null ? String(data.sales) : f.sales,
    }));
    setShowForm(true);
  };

  const saveTarget = (e: React.FormEvent) => {
    e.preventDefault();
    setTarget(setGrowthTarget(businessId, target));
    setTargetSaved(true);
    setTimeout(() => setTargetSaved(false), 2000);
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
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-ink-900">Где вы теряете клиентов</h2>
        {streak >= 2 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-soft px-3 py-1 text-xs font-bold text-violet">
            🔥 {streak} {streak < 5 ? "месяца" : "месяцев"} подряд
          </span>
        )}
      </div>
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
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {[
              { label: "Обращения", value: latest.visitors },
              { label: "Заявки", value: latest.leads },
              { label: "Продажи", value: latest.sales },
              { label: "Повторные", value: latest.repeat },
            ].map((s, i) => (
              <div key={s.label} className="rounded-xl border border-line p-2.5 sm:p-3">
                <p className="font-display text-lg text-ink-900 sm:text-xl">{s.value}</p>
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
          {(latest.avgReceipt || latest.adSpend || latest.reviewsCount || latest.channel) && (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
              {[
                latest.avgReceipt ? `Средний чек: ${latest.avgReceipt.toLocaleString("ru-RU")} ₽` : null,
                latest.adSpend ? `Бюджет: ${latest.adSpend.toLocaleString("ru-RU")} ₽` : null,
                latest.reviewsCount
                  ? `Отзывы: ${latest.reviewsCount}${latest.reviewsRating ? ` (рейтинг ${latest.reviewsRating})` : ""}`
                  : null,
                latest.channel ? `Канал: ${FUNNEL_CHANNEL_LABELS[latest.channel]}` : null,
              ]
                .filter((item): item is string => Boolean(item))
                .map((item) => (
                  <span
                    key={item}
                    className="last:after:content-none after:ml-3 after:text-muted/40 after:content-['·']"
                  >
                    {item}
                  </span>
                ))}
            </div>
          )}
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

      <MetrikaConnect businessId={businessId} onAutofill={handleAutofill} />

      {/* Собственная цель клиента — используется в "Точках роста", чтобы сравнивать факт со своим планом, а не с абстрактной нормой */}
      <form onSubmit={saveTarget} className="mb-6 rounded-xl border border-line bg-soft p-4">
        <p className="mb-3 text-sm font-medium text-ink-900">Ваша цель на месяц (необязательно)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-muted">Заявок в месяц</label>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={target.leadsPerMonth ?? ""}
              onChange={(e) => setTarget({ ...target, leadsPerMonth: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Например, 50"
              className="w-full rounded-xl border border-line bg-white p-3 text-ink-900 outline-none focus:border-violet"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-muted">Продаж в месяц</label>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={target.salesPerMonth ?? ""}
              onChange={(e) => setTarget({ ...target, salesPerMonth: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="Например, 15"
              className="w-full rounded-xl border border-line bg-white p-3 text-ink-900 outline-none focus:border-violet"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="submit"
            className="rounded-full border border-ink-900/20 px-4 py-2 text-sm font-medium text-ink-900 transition hover:bg-ink-900 hover:text-white"
          >
            Сохранить цель
          </button>
          {targetSaved && <span className="text-xs text-violet">Сохранено</span>}
        </div>
      </form>

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

          {showExtra ? (
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-3 text-sm font-medium text-ink-900">
                Дополнительно (необязательно, но точки роста получатся точнее)
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm text-muted">Средний чек, ₽</label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.avgReceipt}
                    onChange={(e) => setForm({ ...form, avgReceipt: e.target.value })}
                    placeholder="Например, 1500"
                    className="w-full rounded-xl border border-line bg-white p-3 text-ink-900 outline-none focus:border-violet"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-muted">Рекламный бюджет за период, ₽</label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.adSpend}
                    onChange={(e) => setForm({ ...form, adSpend: e.target.value })}
                    placeholder="Например, 30000"
                    className="w-full rounded-xl border border-line bg-white p-3 text-ink-900 outline-none focus:border-violet"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-muted">Основной канал обращений</label>
                  <select
                    value={form.channel}
                    onChange={(e) => setForm({ ...form, channel: e.target.value as FunnelChannel | "" })}
                    className="w-full rounded-xl border border-line bg-white p-3 text-ink-900 outline-none focus:border-violet"
                  >
                    <option value="">Не указано</option>
                    {Object.entries(FUNNEL_CHANNEL_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-muted">Скорость ответа на заявки</label>
                  <select
                    value={form.responseSpeed}
                    onChange={(e) => setForm({ ...form, responseSpeed: e.target.value as ResponseSpeed | "" })}
                    className="w-full rounded-xl border border-line bg-white p-3 text-ink-900 outline-none focus:border-violet"
                  >
                    <option value="">Не указано</option>
                    {Object.entries(RESPONSE_SPEED_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-muted">Основная причина отказов</label>
                  <select
                    value={form.dropReason}
                    onChange={(e) => setForm({ ...form, dropReason: e.target.value as DropReason | "" })}
                    className="w-full rounded-xl border border-line bg-white p-3 text-ink-900 outline-none focus:border-violet"
                  >
                    <option value="">Не указано</option>
                    {Object.entries(DROP_REASON_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-muted">Число отзывов сейчас (Карты/2ГИС)</label>
                  <input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={form.reviewsCount}
                    onChange={(e) => setForm({ ...form, reviewsCount: e.target.value })}
                    placeholder="Например, 24"
                    className="w-full rounded-xl border border-line bg-white p-3 text-ink-900 outline-none focus:border-violet"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-muted">Текущий рейтинг (0–5)</label>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    inputMode="decimal"
                    value={form.reviewsRating}
                    onChange={(e) => setForm({ ...form, reviewsRating: e.target.value })}
                    placeholder="Например, 4.7"
                    className="w-full rounded-xl border border-line bg-white p-3 text-ink-900 outline-none focus:border-violet"
                  />
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowExtra(true)}
              className="mt-4 text-sm text-violet underline underline-offset-4 hover:text-ink-900"
            >
              + Добавить средний чек, бюджет и другие данные
            </button>
          )}

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
