"use client";

import { useEffect, useMemo, useState } from "react";
import KpiTile from "@/components/dashboard/KpiTile";
import type { FunnelSnapshot } from "@/lib/funnel";
import { getClients } from "@/lib/crm";
import { getUnitSettings } from "@/lib/unitEconomics";
import { getRisks, saveRisks } from "@/lib/risks";
import {
  DEFAULT_REVIEW_DAYS,
  MAX_RISKS,
  REVIEW_PERIODS,
  REVIEW_PERIOD_LABELS,
  RISK_CATEGORIES,
  RISK_CATEGORY_LABELS,
  RISK_DISCLAIMER,
  RISK_LEVEL_LABELS,
  RISK_STATUSES,
  RISK_STATUS_LABELS,
  Risk,
  RiskTemplate,
  RiskCategory,
  RiskLevel,
  RiskStatus,
  StressRow,
  clampPeriod,
  clampScale,
  findTemplate,
  heatGrid,
  isReviewDue,
  nextReviewAt,
  riskFromTemplate,
  riskLevel,
  riskScore,
  risksForBusiness,
  sortRisks,
  stressTest,
  summarizeRisks,
} from "@/lib/risksCore";
import { pickAutoInputs } from "@/lib/unitEconomicsCore";
import { fmtNum } from "@/lib/dashboard";
import Link from "next/link";
import CompetitorWatch from "./CompetitorWatch";
import NewsWatch from "./NewsWatch";

interface Props {
  businessId: string;
  businessName: string;
  businessType: string;
  snapshots: FunnelSnapshot[];
  /** меняется после синхронизации с сервером — тогда данные перечитываются */
  syncTick: number;
}

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-900 focus:outline-none";

const PROB_LABELS = ["Почти исключено", "Маловероятно", "Возможно", "Вероятно", "Почти наверняка"];
const IMPACT_LABELS = ["Незаметно", "Небольшое", "Заметное", "Серьёзное", "Угроза бизнесу"];

const LEVEL_STYLE: Record<RiskLevel, { badge: string; cell: string }> = {
  high: { badge: "bg-red-50 text-red-700 ring-1 ring-red-200", cell: "bg-red-100 text-red-800" },
  medium: { badge: "bg-amber-50 text-amber-800 ring-1 ring-amber-200", cell: "bg-amber-100 text-amber-900" },
  low: { badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", cell: "bg-emerald-50 text-emerald-800" },
};

const newId = (): string => {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {
    // ниже запасной вариант
  }
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
};

const fmtDate = (iso: string | undefined): string => {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
};

function LevelBadge({ risk }: { risk: Risk }) {
  const score = riskScore(risk);
  const level = riskLevel(score);
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${LEVEL_STYLE[level].badge}`}>
      {RISK_LEVEL_LABELS[level]} · {score}
    </span>
  );
}

function HeatMap({ risks }: { risks: Risk[] }) {
  const grid = useMemo(() => heatGrid(risks), [risks]);
  return (
    <section aria-labelledby="rk-heat" className="mb-6 rounded-2xl border border-line bg-white p-5">
      <h2 id="rk-heat" className="font-display text-base text-ink-900">
        Тепловая карта
      </h2>
      <p className="mt-0.5 text-xs text-muted">Чем правее и выше клетка, тем опаснее риск. В клетке число рисков с такой оценкой (закрытые не считаются).</p>
      <div className="mt-4 overflow-x-auto">
        <table className="mx-auto border-separate border-spacing-1 text-center text-xs" aria-label="Тепловая карта рисков: влияние по вертикали, вероятность по горизонтали">
          <tbody>
            {[4, 3, 2, 1, 0].map((imp) => (
              <tr key={imp}>
                <th scope="row" className="w-8 pr-1 text-right text-[11px] font-normal text-muted sm:w-24 sm:pr-2">
                  <span className="sm:hidden">{imp + 1}</span>
                  <span className="hidden sm:inline">{IMPACT_LABELS[imp]}</span>
                </th>
                {[0, 1, 2, 3, 4].map((prob) => {
                  const n = grid[imp][prob];
                  const level = riskLevel((imp + 1) * (prob + 1));
                  return (
                    <td
                      key={prob}
                      className={`h-10 w-10 rounded-lg text-sm font-semibold sm:h-12 sm:w-14 ${LEVEL_STYLE[level].cell}`}
                      aria-label={`Влияние: ${IMPACT_LABELS[imp]}, вероятность: ${PROB_LABELS[prob]}, рисков: ${n}`}
                    >
                      {n > 0 ? n : <span className="font-normal opacity-30">·</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td />
              {PROB_LABELS.map((l, i) => (
                <th key={l} scope="col" className="px-0.5 pt-1 text-[10px] font-normal leading-tight text-muted">
                  <span className="sm:hidden">{i + 1}</span>
                  <span className="hidden sm:inline">{l}</span>
                </th>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="mt-1 text-center text-[11px] text-muted">Вероятность → · по вертикали влияние (внизу меньше, вверху больше)</p>
      </div>
    </section>
  );
}

function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <select
        className={inputCls}
        value={String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          const match = options.find((o) => String(o.value) === raw);
          if (match) onChange(match.value);
        }}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const PROB_OPTIONS = PROB_LABELS.map((l, i) => ({ value: i + 1, label: `${i + 1} — ${l}` }));
const IMPACT_OPTIONS = IMPACT_LABELS.map((l, i) => ({ value: i + 1, label: `${i + 1} — ${l}` }));
const CATEGORY_OPTIONS = RISK_CATEGORIES.map((c) => ({ value: c as RiskCategory, label: RISK_CATEGORY_LABELS[c] }));
const STATUS_OPTIONS = RISK_STATUSES.map((s) => ({ value: s as RiskStatus, label: RISK_STATUS_LABELS[s] }));
const PERIOD_OPTIONS = REVIEW_PERIODS.map((d) => ({ value: d, label: REVIEW_PERIOD_LABELS[d] ?? `Раз в ${d} дн.` }));

function RiskEditor({ risk, onSave, onCancel }: { risk: Risk; onSave: (r: Risk) => void; onCancel: () => void }) {
  const [d, setD] = useState<Risk>(risk);
  const set = <K extends keyof Risk>(k: K, v: Risk[K]) => setD((p) => ({ ...p, [k]: v }));
  const valid = d.title.trim().length > 0;
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-soft p-4">
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Что может случиться</span>
        <input className={inputCls} value={d.title} maxLength={200} onChange={(e) => set("title", e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Категория" value={d.category} options={CATEGORY_OPTIONS} onChange={(v) => set("category", v)} />
        <Select label="Статус" value={d.status} options={STATUS_OPTIONS} onChange={(v) => set("status", v)} />
        <Select label="Вероятность" value={d.probability} options={PROB_OPTIONS} onChange={(v) => set("probability", clampScale(v))} />
        <Select label="Влияние на бизнес, если случится" value={d.impact} options={IMPACT_OPTIONS} onChange={(v) => set("impact", clampScale(v))} />
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">За чем следим: где и по каким признакам заметите, что угроза приближается</span>
        <textarea className={inputCls} rows={2} maxLength={600} value={d.signal ?? ""} onChange={(e) => set("signal", e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Как готовимся заранее</span>
        <textarea className={inputCls} rows={3} maxLength={1500} value={d.measures ?? ""} onChange={(e) => set("measures", e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">План Б: что делаем в первые дни, если угроза наступила</span>
        <textarea className={inputCls} rows={3} maxLength={1500} value={d.plan ?? ""} onChange={(e) => set("plan", e.target.value)} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Ключевые слова для подбора новостей (через запятую; необязательно)</span>
        <input className={inputCls} maxLength={300} placeholder="Например: маркировка рекламы, штраф, роскомнадзор" value={d.watch ?? ""} onChange={(e) => set("watch", e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Как часто проверять" value={clampPeriod(d.reviewEveryDays)} options={PERIOD_OPTIONS} onChange={(v) => set("reviewEveryDays", v)} />
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-muted">Заметка (необязательно)</span>
        <textarea className={inputCls} rows={2} maxLength={600} value={d.note ?? ""} onChange={(e) => set("note", e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          disabled={!valid}
          onClick={() => onSave({ ...d, title: d.title.trim() })}
          className="rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-40"
        >
          Сохранить
        </button>
        <button onClick={onCancel} className="rounded-full border border-line px-5 py-2 text-sm text-ink-900/75 hover:bg-white">
          Отмена
        </button>
      </div>
    </div>
  );
}

const STRESS_TEXT: Record<string, { tone: string; label: string }> = {
  good: { tone: "text-emerald-700", label: "Выдерживает" },
  weak: { tone: "text-amber-800", label: "Запас небольшой" },
  loss: { tone: "text-red-700", label: "Уходит в минус" },
};

function StressTable({ rows }: { rows: StressRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="pb-2 pr-3 font-normal">Если случится</th>
            <th className="pb-2 pr-3 font-normal">Прибыль с покупки</th>
            <th className="pb-2 font-normal">Итог</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const v = r.verdict ? STRESS_TEXT[r.verdict] : null;
            return (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="py-2 pr-3">
                  <span className="font-medium text-ink-900">{r.label}</span>
                  <span className="block text-xs text-muted">{r.hint}</span>
                </td>
                <td className="py-2 pr-3 text-ink-900">{r.profitPerPurchase === null ? "—" : `${fmtNum(r.profitPerPurchase)} ₽`}</td>
                <td className={`py-2 font-medium ${v?.tone ?? "text-ink-900"}`}>
                  {v ? v.label : "—"}
                  {r.ltvCac !== null && <span className="ml-1 text-xs font-normal text-muted">LTV÷CAC {fmtNum(r.ltvCac, 1)}×</span>}
                  {r.firstDealProfit !== null && (
                    <span className="ml-1 text-xs font-normal text-muted">
                      {r.firstDealProfit < 0 ? "−" : "+"}
                      {fmtNum(Math.abs(r.firstDealProfit))} ₽ с 1-й покупки
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Управление рисками: внешние угрозы (законы, конкуренты, политика, поставки, экономика) — реестр, проверки по расписанию и стресс-тест. */
export default function RisksManager({ businessId, businessName, businessType, snapshots, syncTick }: Props) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [now, setNow] = useState<Date>(() => new Date());
  const [stress, setStress] = useState<ReturnType<typeof stressTest>>(null);

  useEffect(() => {
    setRisks(getRisks(businessId));
    const at = new Date();
    setNow(at);
    const auto = pickAutoInputs(snapshots, getClients(businessId), at);
    const picked = auto.crm ?? auto.funnel;
    const unit = getUnitSettings(businessId);
    setStress(
      picked
        ? stressTest({
            spend: picked.spend,
            customers: picked.customers,
            avgCheck: picked.avgCheck,
            marginPct: unit.marginPct ?? null,
            purchases: unit.purchases ?? picked.purchasesHint ?? 1,
          })
        : null
    );
  }, [businessId, snapshots, syncTick]);

  const persist = (next: Risk[]) => setRisks(saveRisks(businessId, next));

  // Библиотеку типовых угроз ведёт администратор; если сервер недоступен, берём встроенный список
  const [library, setLibrary] = useState<RiskTemplate[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/risks/templates?businessType=${encodeURIComponent(businessType)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { templates?: RiskTemplate[] | null }) => live && Array.isArray(d.templates) && setLibrary(d.templates))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [businessType]);
  const templates = useMemo(() => library ?? risksForBusiness(businessType), [library, businessType]);
  const inRegistry = useMemo(() => new Set(risks.map((r) => r.templateId).filter(Boolean) as string[]), [risks]);
  const freeTemplates = templates.filter((t) => !inRegistry.has(t.id));
  const summary = useMemo(() => summarizeRisks(risks, now), [risks, now]);
  const sorted = useMemo(() => sortRisks(risks), [risks]);
  const full = risks.length >= MAX_RISKS;

  const addTemplate = (id: string) => {
    const tpl = templates.find((x) => x.id === id) ?? findTemplate(id, businessType);
    if (!tpl || full || inRegistry.has(id)) return;
    persist([riskFromTemplate(tpl, new Date(), newId), ...risks]);
  };

  const addAll = () => {
    const room = MAX_RISKS - risks.length;
    if (room <= 0) return;
    const created = freeTemplates.slice(0, room).map((t) => riskFromTemplate(t, new Date(), newId));
    persist([...created, ...risks]);
    setShowLibrary(false);
  };

  const addCustom = () => {
    const title = newTitle.trim();
    if (!title || full) return;
    const at = new Date();
    const base: Risk = {
      id: newId(),
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      title: title.slice(0, 200),
      category: "economy",
      probability: 3,
      impact: 3,
      status: "open",
      reviewEveryDays: DEFAULT_REVIEW_DAYS,
    };
    const r = { ...base, reviewAt: nextReviewAt(base, at) };
    persist([r, ...risks]);
    setNewTitle("");
    setEditing(r.id);
  };

  /** Сохранение правок и отметка «проверил»: следующая проверка отсчитывается от сегодня. */
  const saveOne = (r: Risk) => {
    const at = new Date();
    const next: Risk = { ...r, updatedAt: at.toISOString(), reviewAt: nextReviewAt(r, at) };
    persist(risks.map((x) => (x.id === r.id ? next : x)));
    setEditing(null);
    setNow(at);
  };

  const remove = (id: string) => {
    persist(risks.filter((r) => r.id !== id));
    if (editing === id) setEditing(null);
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink-900 sm:text-3xl">Управление рисками</h1>
        <p className="mt-1 text-sm text-muted">
          «{businessName}»: внешние угрозы, на которые вы не влияете, но к которым можно подготовиться. Новые законы, ход конкурентов, ограничения на поставки, изменения в экономике и обществе. «Точки роста» показывают, где вырасти, а этот раздел помогает не потерять достигнутое.
        </p>
      </header>

      <section aria-label="Итоги" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Высокие угрозы" value={String(summary.high)} hint={summary.total ? `из ${summary.total} в реестре` : "реестр пуст"} />
        <KpiTile label="Средние угрозы" value={String(summary.medium)} hint="нужен план" />
        <KpiTile label="Без плана" value={String(summary.noPlan)} hint="высокие и средние, без подготовки и плана Б" />
        <KpiTile label="Проверить на неделе" value={String(summary.checkSoon.length)} hint={summary.reviewDue ? `из них просрочено: ${summary.reviewDue}` : "по вашему расписанию"} />
      </section>

      {summary.checkSoon.length > 0 && (
        <section aria-labelledby="rk-soon" className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <h2 id="rk-soon" className="font-display text-base text-ink-900">
            Что проверить в ближайшие дни
          </h2>
          <p className="mt-0.5 text-xs text-muted">Посмотрите источники, отметьте «проверил», если ничего не изменилось, или обновите оценку.</p>
          <ul className="mt-3 space-y-3">
            {summary.checkSoon.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-4">
                <p className="text-sm font-medium text-ink-900">{r.title}</p>
                {r.signal && (
                  <p className="mt-1 text-sm text-ink-900/80">
                    <span className="text-muted">Где смотреть: </span>
                    {r.signal}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <button onClick={() => saveOne(r)} className="rounded-full bg-ink-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-ink-800">
                    Проверил, без изменений
                  </button>
                  <button onClick={() => setEditing(r.id)} className="text-sm text-violet underline underline-offset-4 hover:text-ink-900">
                    Изменить оценку
                  </button>
                  <span className={`text-xs ${isReviewDue(r, now) ? "font-medium text-amber-800" : "text-muted"}`}>
                    {isReviewDue(r, now) ? "Срок был " : "Срок "}
                    {fmtDate(r.reviewAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {risks.length > 0 && <HeatMap risks={risks} />}

      <section aria-labelledby="rk-registry" className="mb-6 rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="rk-registry" className="font-display text-base text-ink-900">
            Реестр угроз {risks.length > 0 && <span className="text-sm font-normal text-muted">({risks.length})</span>}
          </h2>
          <button onClick={() => setShowLibrary((v) => !v)} aria-expanded={showLibrary} className="text-sm text-violet underline underline-offset-4 hover:text-ink-900">
            {showLibrary ? "Скрыть типовые угрозы" : `Типовые угрозы для вашей ниши (${freeTemplates.length})`}
          </button>
        </div>

        {risks.length === 0 && (
          <p className="mt-3 rounded-xl bg-soft p-4 text-sm text-ink-900/80">
            Пока пусто. Начните с типовых угроз для вашего типа бизнеса: добавьте те, что актуальны, и оцените вероятность и влияние. Потом допишите свои.
            {freeTemplates.length > 0 && (
              <button onClick={addAll} className="ml-2 font-medium text-violet underline underline-offset-4 hover:text-ink-900">
                Добавить все {freeTemplates.length}
              </button>
            )}
          </p>
        )}

        {showLibrary && (
          <div className="mt-3 rounded-xl border border-line p-4">
            {freeTemplates.length === 0 ? (
              <p className="text-sm text-muted">Все типовые угрозы уже в вашем реестре.</p>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted">Оценки в шаблонах ориентировочные. Поправьте их под свой бизнес.</p>
                  <button onClick={addAll} disabled={full} className="text-sm text-violet underline underline-offset-4 hover:text-ink-900 disabled:opacity-40">
                    Добавить все
                  </button>
                </div>
                <ul className="space-y-2">
                  {freeTemplates.map((tpl) => (
                    <li key={tpl.id} className="flex items-start justify-between gap-3 rounded-xl bg-soft p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">{tpl.title}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {RISK_CATEGORY_LABELS[tpl.category]}. {tpl.what}
                        </p>
                      </div>
                      <button
                        disabled={full}
                        onClick={() => addTemplate(tpl.id)}
                        className="shrink-0 rounded-full border border-ink-900 px-3 py-1 text-xs font-medium text-ink-900 hover:bg-ink-900 hover:text-white disabled:opacity-40"
                      >
                        Добавить
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {sorted.length > 0 && (
          <ul className="mt-4 space-y-3">
            {sorted.map((r) => {
              const due = isReviewDue(r, now);
              const isEditing = editing === r.id;
              const noPlan = r.status !== "controlled" && riskLevel(riskScore(r)) !== "low" && !(r.measures ?? "").trim() && !(r.plan ?? "").trim();
              return (
                <li key={r.id} className={`rounded-xl border p-4 ${r.status === "controlled" ? "border-line bg-soft/60" : "border-line"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">{r.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {RISK_CATEGORY_LABELS[r.category]} · вероятность {r.probability}/5 · влияние {r.impact}/5
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <LevelBadge risk={r} />
                      <span className="rounded-full bg-soft px-2.5 py-0.5 text-xs text-ink-900/80">{RISK_STATUS_LABELS[r.status]}</span>
                    </div>
                  </div>

                  {!isEditing && (
                    <>
                      {r.signal && (
                        <p className="mt-2 text-sm text-ink-900/80">
                          <span className="text-muted">За чем следим: </span>
                          {r.signal}
                        </p>
                      )}
                      {r.measures && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink-900/80">
                          <span className="text-muted">Готовимся: </span>
                          {r.measures}
                        </p>
                      )}
                      {r.plan && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-ink-900/80">
                          <span className="text-muted">План Б: </span>
                          {r.plan}
                        </p>
                      )}
                      {noPlan && <p className="mt-1 text-sm text-amber-800">Нет ни подготовки, ни плана Б. Запишите хотя бы первые шаги.</p>}
                      {r.note && <p className="mt-1 text-xs text-muted">{r.note}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        <button onClick={() => setEditing(r.id)} className="text-violet underline underline-offset-4 hover:text-ink-900">
                          Изменить
                        </button>
                        {due && (
                          <button onClick={() => saveOne(r)} className="text-amber-800 underline underline-offset-4 hover:text-ink-900">
                            Проверил, без изменений
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (window.confirm("Удалить угрозу из реестра?")) remove(r.id);
                          }}
                          className="text-muted underline underline-offset-4 hover:text-ink-900"
                        >
                          Удалить
                        </button>
                        {r.reviewAt && r.status !== "controlled" && (
                          <span className={`text-xs ${due ? "font-medium text-amber-800" : "text-muted"}`}>
                            {due ? "Пора проверить, срок был " : `${REVIEW_PERIOD_LABELS[clampPeriod(r.reviewEveryDays)] ?? "Проверка"}, следующая `}
                            {fmtDate(r.reviewAt)}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  {isEditing && <RiskEditor risk={r} onSave={saveOne} onCancel={() => setEditing(null)} />}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5 flex flex-wrap items-end gap-2 border-t border-line pt-4">
          <label className="min-w-[220px] flex-1 text-sm">
            <span className="mb-1 block text-xs text-muted">Своя угроза</span>
            <input
              className={inputCls}
              placeholder="Например: запрет на ввоз основного товара"
              value={newTitle}
              maxLength={200}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addCustom();
              }}
            />
          </label>
          <button
            onClick={addCustom}
            disabled={!newTitle.trim() || full}
            className="rounded-full bg-ink-900 px-5 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-40"
          >
            Добавить
          </button>
        </div>
        {full && <p className="mt-2 text-xs text-muted">В реестре максимум {MAX_RISKS} угроз. Удалите неактуальные, чтобы добавить новые.</p>}
      </section>

      <NewsWatch risks={risks} templates={templates} />

      <CompetitorWatch businessId={businessId} syncTick={syncTick} hasCompetitorRisk={inRegistry.has("x-competitor-usp")} onAddRisk={() => addTemplate("x-competitor-usp")} />

      <section aria-labelledby="rk-stress" className="mb-6 rounded-2xl border border-line bg-white p-5">
        <h2 id="rk-stress" className="font-display text-base text-ink-900">
          Запас прочности: что будет с прибылью, если угроза сработает
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Считается по тем же цифрам, что и «Юнит-экономика». Это не прогноз, а проверка, насколько вы переживёте подорожание, скидки или рост цены клиента.
        </p>
        {stress ? (
          <>
            <p className="mt-3 text-sm text-ink-900/80">
              Сейчас: прибыль с покупки {stress.base.profitPerPurchase === null ? "—" : `${fmtNum(stress.base.profitPerPurchase)} ₽`}, цена привлечения клиента {stress.base.cac === null ? "—" : `${fmtNum(stress.base.cac)} ₽`}.
            </p>
            <StressTable rows={stress.rows} />
          </>
        ) : (
          <p className="mt-3 rounded-xl bg-soft p-4 text-sm text-ink-900/80">
            Чтобы увидеть запас прочности, заполните воронку (расходы на рекламу, продажи, средний чек) и укажите маржу в разделе{" "}
            <Link href={`/business/${businessId}/unit-economics`} className="font-medium text-violet underline underline-offset-4 hover:text-ink-900">
              «Юнит-экономика»
            </Link>
            .
          </p>
        )}
      </section>

      <p className="text-xs text-muted">{RISK_DISCLAIMER}</p>
    </div>
  );
}
