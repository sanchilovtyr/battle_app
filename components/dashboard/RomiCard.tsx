"use client";

import { useState } from "react";
import type { PeriodMetrics } from "@/lib/dashboard";
import { fmtNum, romiReturnPerRuble, romiWithMargin } from "@/lib/dashboard";

interface Props {
  latest: PeriodMetrics;
  previous: PeriodMetrics | null;
}

/** ROMI за последний период: возврат вложений в продвижение, с пояснением формулы и расчётом по прибыли (маржа вводится здесь же). */
export default function RomiCard({ latest, previous }: Props) {
  const [margin, setMargin] = useState("");
  const marginNum = Number(margin.replace(",", "."));
  const byProfit = margin ? romiWithMargin(latest.revenue, latest.adSpend, marginNum) : null;
  const romi = latest.romi;
  const back = romiReturnPerRuble(romi);
  const prev = previous?.romi ?? null;
  const diff = romi !== null && prev !== null ? Math.round((romi - prev) * 10) / 10 : null;

  const verdict =
    romi === null
      ? null
      : romi > 0
        ? { tone: "text-emerald-700", text: "Продвижение окупилось: выручка с продаж больше расходов." }
        : romi === 0
          ? { tone: "text-ink-900", text: "Ровно в ноль: выручка равна расходам." }
          : { tone: "text-red-700", text: "Пока не окупилось: расходы больше выручки за этот период." };

  return (
    <section aria-labelledby="romi-title" className="mb-6 rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <h2 id="romi-title" className="font-display text-base text-ink-900">
            ROMI · возврат вложений в продвижение
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            (Выручка − Расходы) ÷ Расходы × 100%. Период: {latest.label}
          </p>
        </div>
        {romi !== null && (
          <p className="font-display text-2xl leading-none text-ink-900 sm:text-3xl">
            {romi > 0 ? "+" : ""}
            {fmtNum(romi, 1)}
            <span className="ml-1 text-base text-muted">%</span>
          </p>
        )}
      </div>

      {romi === null ? (
        <p className="mt-3 rounded-xl bg-soft p-3 text-sm text-muted">
          Чтобы посчитать ROMI, внесите за период рекламный бюджет, средний чек и число продаж в блоке «Где вы теряете клиентов».
        </p>
      ) : (
        <>
          {verdict && <p className={`mt-3 text-sm font-medium ${verdict.tone}`}>{verdict.text}</p>}
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-xl bg-soft p-3">
              <dt className="text-xs text-muted">Расходы на продвижение</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{fmtNum(latest.adSpend)} ₽</dd>
            </div>
            <div className="rounded-xl bg-soft p-3">
              <dt className="text-xs text-muted">Оценочная выручка</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{fmtNum(latest.revenue)} ₽</dd>
            </div>
            <div className="rounded-xl bg-soft p-3">
              <dt className="text-xs text-muted">С каждого вложенного рубля</dt>
              <dd className="mt-0.5 font-medium text-ink-900">{fmtNum(back, 2)} ₽ выручки</dd>
            </div>
          </dl>
          {diff !== null && (
            <p className="mt-2 text-xs text-muted">
              К прошлому периоду: {diff > 0 ? "+" : diff < 0 ? "−" : ""}
              {fmtNum(Math.abs(diff), 1)} п.п. ({fmtNum(prev, 1)}% → {fmtNum(romi, 1)}%)
            </p>
          )}

          <div className="mt-4 rounded-xl border border-line p-3">
            <label htmlFor="romi-margin" className="text-sm text-ink-900">
              ROMI по прибыли — укажите вашу маржу, %
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input
                id="romi-margin"
                inputMode="decimal"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                placeholder="например, 40"
                className="w-32 rounded-lg border border-line px-3 py-2 text-sm text-ink-900 outline-none focus:border-violet"
              />
              {byProfit !== null ? (
                <span className={`text-sm font-medium ${byProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  ROMI по прибыли: {byProfit > 0 ? "+" : ""}
                  {fmtNum(byProfit, 1)}%
                </span>
              ) : margin ? (
                <span className="text-xs text-muted">Введите маржу от 1 до 100</span>
              ) : (
                <span className="text-xs text-muted">Маржа — доля прибыли в цене: 40% значит, что с 1000 ₽ выручки остаётся 400 ₽ до расходов на продвижение.</span>
              )}
            </div>
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-muted">
        Расчёт по внесённым вами цифрам: в выручку входят только первые продажи периода (повторные покупки не учитываются), в расходы — только рекламный
        бюджет, который вы указали. Если есть другие расходы (оплата специалиста, сервисы), добавьте их в бюджет периода, иначе ROMI будет завышен.
      </p>
    </section>
  );
}
