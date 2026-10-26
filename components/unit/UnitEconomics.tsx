"use client";

import { useEffect, useMemo, useState } from "react";
import KpiTile from "@/components/dashboard/KpiTile";
import { fmtNum } from "@/lib/dashboard";
import type { FunnelSnapshot } from "@/lib/funnel";
import { getClients } from "@/lib/crm";
import { getUnitSettings, saveUnitSettings } from "@/lib/unitEconomics";
import { AutoInput, UnitInput, UnitResult, UnitVerdict, computeUnit, crmLooksIncomplete, pickAutoInputs, scenario } from "@/lib/unitEconomicsCore";

interface Props {
  businessId: string;
  businessName: string;
  snapshots: FunnelSnapshot[];
  /** меняется после синхронизации с сервером — тогда данные перечитываются */
  syncTick: number;
}

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink-900 focus:border-ink-900 focus:outline-none";

/** Число из поля ввода: пусто или не число → null. */
const parseNum = (s: string): number | null => {
  const t = s.replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const sign = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");

const VERDICT: Record<UnitVerdict, { tone: string; box: string }> = {
  good: { tone: "text-emerald-700", box: "border-emerald-200 bg-emerald-50" },
  weak: { tone: "text-amber-800", box: "border-amber-200 bg-amber-50" },
  loss: { tone: "text-red-700", box: "border-red-200 bg-red-50" },
};

function verdictText(r: UnitResult): string | null {
  if (!r.verdict) return null;
  if (r.repeatMode && r.ltvCac !== null) {
    if (r.verdict === "good") return `Привлечение окупается с запасом: клиент приносит ${fmtNum(r.ltvCac, 1)}× от затрат на него (ориентир — от 3×).`;
    if (r.verdict === "weak") return `Окупается, но запас небольшой: ${fmtNum(r.ltvCac, 1)}× от затрат (ориентир — от 3×). Снижайте цену привлечения или повышайте чек и число покупок.`;
    return `Пока в минус: клиент приносит ${fmtNum(r.ltvCac, 1)}× от затрат на него, то есть меньше, чем стоит привлечь.`;
  }
  if (r.verdict === "good") return "Привлечение окупается уже с первой покупки.";
  return "С первой покупки клиент не окупается. Если он возвращается, укажите, сколько покупок он делает в среднем, и расчёт обновится.";
}

function Field({
  label,
  hint,
  value,
  onChange,
  suffix,
  autoFilled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  autoFilled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-center justify-between gap-2 text-xs text-muted">
        <span>{label}</span>
        {autoFilled && <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] text-ink-900/70">подставлено</span>}
      </span>
      <div className="relative">
        <input className={`${inputCls} pr-12`} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, "").slice(0, 12))} />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>
      </div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-baseline justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="text-sm font-medium text-ink-900">
          {sign(value)}
          {Math.abs(value)} {unit}
        </span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-ink-900" />
    </label>
  );
}

/** Юнит-экономика: CAC, LTV, окупаемость клиента. Данные подставляются из воронки и CRM, поля можно править. */
export default function UnitEconomics({ businessId, businessName, snapshots, syncTick }: Props) {
  const [auto, setAuto] = useState<{ crm: AutoInput | null; funnel: AutoInput | null }>({ crm: null, funnel: null });
  const [source, setSource] = useState<"crm" | "funnel">("funnel");
  const [spend, setSpend] = useState("");
  const [customers, setCustomers] = useState("");
  const [avgCheck, setAvgCheck] = useState("");
  const [margin, setMargin] = useState("");
  const [purchases, setPurchases] = useState("");
  const [touched, setTouched] = useState(false); // пользователь правил подставленные цифры вручную
  const [dCac, setDCac] = useState(0);
  const [dCheck, setDCheck] = useState(0);
  const [dMargin, setDMargin] = useState(0);

  // допущения, которые пользователь вводит сам (маржа, покупок на клиента)
  useEffect(() => {
    const s = getUnitSettings(businessId);
    setMargin(s.marginPct !== undefined ? String(s.marginPct) : "");
    setPurchases(s.purchases !== undefined ? String(s.purchases) : "");
  }, [businessId, syncTick]);

  // данные из сервиса: CRM за 90 дней, если есть оплаты, иначе последний период воронки
  useEffect(() => {
    const a = pickAutoInputs(snapshots, getClients(businessId), new Date());
    setAuto(a);
    setSource(a.crm ? "crm" : "funnel");
    setTouched(false);
  }, [businessId, snapshots, syncTick]);

  const picked = auto[source];
  const fill = (a: AutoInput | null) => {
    setSpend(a ? String(a.spend) : "");
    setCustomers(a ? String(a.customers) : "");
    setAvgCheck(a?.avgCheck ? String(a.avgCheck) : "");
  };
  useEffect(() => {
    if (!touched) fill(picked);
  }, [picked, touched]);

  const persist = (m: string, p: string) => {
    const mv = parseNum(m);
    const pv = parseNum(p);
    saveUnitSettings(businessId, {
      ...(mv !== null && mv <= 100 ? { marginPct: mv } : {}),
      ...(pv !== null && pv >= 1 && pv <= 100 ? { purchases: pv } : {}),
    });
  };

  const purchasesNum = (() => {
    const p = parseNum(purchases);
    return p !== null && p >= 1 ? Math.min(p, 100) : 1;
  })();
  const marginNum = (() => {
    const m = parseNum(margin);
    return m !== null && m <= 100 ? m : null;
  })();

  const input: UnitInput = useMemo(
    () => ({ spend: parseNum(spend), customers: parseNum(customers), avgCheck: parseNum(avgCheck), marginPct: marginNum, purchases: purchasesNum }),
    [spend, customers, avgCheck, marginNum, purchasesNum]
  );
  const base = useMemo(() => computeUnit(input), [input]);
  const what = useMemo(() => scenario(input, { cacPct: dCac, checkPct: dCheck, marginPoints: dMargin }), [input, dCac, dCheck, dMargin]);
  const changed = dCac !== 0 || dCheck !== 0 || dMargin !== 0;
  const text = verdictText(base);
  const hasAuto = !!(auto.crm || auto.funnel);
  const autoFilled = !touched && !!picked;

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl text-ink-900 sm:text-3xl">Юнит-экономика</h1>
        <p className="mt-1 text-sm text-muted">
          «{businessName}»: сколько стоит привлечь клиента, сколько прибыли он приносит и окупается ли реклама.
        </p>
      </header>

      <section aria-labelledby="ue-data" className="mb-6 rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 id="ue-data" className="font-display text-base text-ink-900">
            Исходные данные
          </h2>
          {auto.crm && auto.funnel && (
            <div className="flex gap-2" role="group" aria-label="Откуда взять данные">
              {(["crm", "funnel"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSource(s);
                    setTouched(false);
                  }}
                  aria-pressed={source === s}
                  className={`rounded-full border px-3 py-1.5 text-xs ${source === s ? "border-ink-900 bg-ink-900 font-semibold text-white" : "border-line text-ink-900/75 hover:bg-soft"}`}
                >
                  {s === "crm" ? "CRM, 90 дней" : "Последний период воронки"}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasAuto && picked ? (
          <p className="mt-1 text-xs text-muted">
            {picked.source === "crm"
              ? `Расходы взяты из воронки, оплаты и средний чек из CRM: ${picked.label}.`
              : `Данные воронки за период «${picked.label}».`}{" "}
            Цифры можно поправить.
            {touched && (
              <>
                {" "}
                <button onClick={() => setTouched(false)} className="underline underline-offset-4 hover:text-ink-900">
                  Вернуть подставленные
                </button>
              </>
            )}
          </p>
        ) : (
          <p className="mt-3 rounded-xl bg-soft p-3 text-sm text-muted">
            Для автоподстановки внесите в «Где вы теряете клиентов» рекламный бюджет и число продаж за период, а в «Клиентах (CRM)» отмечайте оплаты. Пока можно ввести цифры вручную.
          </p>
        )}

        {crmLooksIncomplete(picked) && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            В воронке за эти 90 дней указано {fmtNum(picked?.funnelSales ?? 0)} продаж, а в CRM отмечено оплат: {fmtNum(picked?.customers ?? 0)}. Если часть клиентов не внесена в CRM,
            цена привлечения получится завышенной. Сравните с режимом «Последний период воронки» или дополните CRM.
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field
            label="Расходы на привлечение за период"
            suffix="₽"
            value={spend}
            autoFilled={autoFilled}
            onChange={(v) => {
              setSpend(v);
              setTouched(true);
            }}
          />
          <Field
            label="Новых платящих клиентов за тот же период"
            suffix="чел."
            value={customers}
            autoFilled={autoFilled}
            onChange={(v) => {
              setCustomers(v);
              setTouched(true);
            }}
          />
          <Field
            label="Средний чек"
            suffix="₽"
            value={avgCheck}
            autoFilled={autoFilled && !!picked?.avgCheck}
            onChange={(v) => {
              setAvgCheck(v);
              setTouched(true);
            }}
          />
          <Field
            label="Маржа с продажи"
            suffix="%"
            value={margin}
            hint="Какая доля чека остаётся после себестоимости, без рекламы."
            onChange={(v) => {
              setMargin(v);
              persist(v, purchases);
            }}
          />
          <Field
            label="Покупок на клиента за всё время"
            suffix="шт."
            value={purchases}
            hint={
              picked?.purchasesHint && picked.purchasesHint > 1
                ? `По вашей воронке выходит около ${fmtNum(picked.purchasesHint, 1)}. 1 — если покупают один раз.`
                : "1 — если клиент покупает один раз."
            }
            onChange={(v) => {
              setPurchases(v);
              persist(margin, v);
            }}
          />
        </div>
      </section>

      <section aria-label="Итоги" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Цена привлечения (CAC)" value={fmtNum(base.cac)} unit="₽" hint="расходы ÷ новые клиенты" />
        <KpiTile label="Прибыль с покупки" value={fmtNum(base.profitPerPurchase)} unit="₽" hint={marginNum === null ? "укажите маржу" : "чек × маржа"} />
        <KpiTile
          label={base.repeatMode ? "Прибыль с клиента (LTV)" : "Прибыль с 1-й покупки − CAC"}
          value={base.repeatMode ? fmtNum(base.ltv) : base.firstDealProfit === null ? "—" : `${sign(base.firstDealProfit)}${fmtNum(Math.abs(base.firstDealProfit))}`}
          unit="₽"
          hint={base.repeatMode ? `за ${fmtNum(purchasesNum, 1)} покупок` : "клиент без повторных покупок"}
        />
        <KpiTile
          label={base.repeatMode ? "LTV ÷ CAC" : "Окупается за"}
          value={base.repeatMode ? (base.ltvCac === null ? "—" : fmtNum(base.ltvCac, 1)) : base.paybackPurchases === null ? "—" : fmtNum(base.paybackPurchases, 1)}
          unit={base.repeatMode ? "×" : "покупки"}
          hint={base.repeatMode ? "ориентир — от 3×" : "число покупок до окупаемости"}
        />
      </section>

      {text && base.verdict && (
        <p className={`mb-6 rounded-2xl border p-4 text-sm font-medium ${VERDICT[base.verdict].box} ${VERDICT[base.verdict].tone}`}>{text}</p>
      )}

      {base.maxCac !== null && base.cac !== null && (
        <section aria-labelledby="ue-cac" className="mb-6 rounded-2xl border border-line bg-white p-5">
          <h2 id="ue-cac" className="font-display text-base text-ink-900">
            Сколько можно платить за клиента
          </h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-soft p-3">
              <dt className="text-xs text-muted">Сейчас</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{fmtNum(base.cac)} ₽</dd>
            </div>
            <div className="rounded-xl bg-soft p-3">
              <dt className="text-xs text-muted">Комфортно (треть LTV)</dt>
              <dd className="mt-0.5 font-medium text-ink-900">до {fmtNum(base.comfortCac)} ₽</dd>
            </div>
            <div className="rounded-xl bg-soft p-3">
              <dt className="text-xs text-muted">Предел, выше — убыток</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{fmtNum(base.maxCac)} ₽</dd>
            </div>
          </dl>
        </section>
      )}

      {base.cac !== null && marginNum !== null && (
        <section aria-labelledby="ue-what" className="mb-6 rounded-2xl border border-line bg-white p-5">
          <h2 id="ue-what" className="font-display text-base text-ink-900">
            Что если изменится
          </h2>
          <p className="mt-0.5 text-xs text-muted">Подвигайте ползунки и посмотрите, как поменяются итоги.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Slider label="Цена привлечения" value={dCac} min={-50} max={100} step={5} unit="%" onChange={setDCac} />
            <Slider label="Средний чек" value={dCheck} min={-50} max={50} step={5} unit="%" onChange={setDCheck} />
            <Slider label="Маржа" value={dMargin} min={-20} max={20} step={1} unit="п.п." onChange={setDMargin} />
          </div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-soft p-3">
              <dt className="text-xs text-muted">CAC</dt>
              <dd className="mt-0.5 font-medium text-ink-900">
                {fmtNum(what.cac)} ₽{changed && <span className="ml-1 text-xs font-normal text-muted">было {fmtNum(base.cac)}</span>}
              </dd>
            </div>
            <div className="rounded-xl bg-soft p-3">
              <dt className="text-xs text-muted">{base.repeatMode ? "LTV ÷ CAC" : "Прибыль с 1-й покупки − CAC"}</dt>
              <dd className="mt-0.5 font-medium text-ink-900">
                {base.repeatMode
                  ? `${fmtNum(what.ltvCac, 1)}×`
                  : what.firstDealProfit === null
                    ? "—"
                    : `${sign(what.firstDealProfit)}${fmtNum(Math.abs(what.firstDealProfit))} ₽`}
                {changed && (
                  <span className="ml-1 text-xs font-normal text-muted">
                    было{" "}
                    {base.repeatMode ? `${fmtNum(base.ltvCac, 1)}×` : base.firstDealProfit === null ? "—" : `${sign(base.firstDealProfit)}${fmtNum(Math.abs(base.firstDealProfit))} ₽`}
                  </span>
                )}
              </dd>
            </div>
            <div className="rounded-xl bg-soft p-3">
              <dt className="text-xs text-muted">Итог</dt>
              <dd className={`mt-0.5 font-medium ${what.verdict ? VERDICT[what.verdict].tone : "text-ink-900"}`}>
                {what.verdict === "good" ? "Окупается" : what.verdict === "weak" ? "Запас небольшой" : what.verdict === "loss" ? "В минус" : "—"}
              </dd>
            </div>
          </dl>
          {changed && (
            <button
              onClick={() => {
                setDCac(0);
                setDCheck(0);
                setDMargin(0);
              }}
              className="mt-3 text-sm text-muted underline underline-offset-4 hover:text-ink-900"
            >
              Сбросить ползунки
            </button>
          )}
        </section>
      )}

      <p className="text-xs text-muted">
        Это оценка по цифрам, которые вы внесли, а не финансовая консультация и не прогноз. Маржа и число покупок на клиента задаются вами, ориентир «от 3×» —
        общепринятое правило, для вашей отрасли порог может быть другим.
      </p>
    </div>
  );
}
