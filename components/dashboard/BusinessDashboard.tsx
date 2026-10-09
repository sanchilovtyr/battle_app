"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FunnelSnapshot } from "@/lib/funnel";
import type { ProgressPoint } from "@/lib/progressHistory";
import type { GrowthTarget } from "@/lib/growthTarget";
import {
  buildInsights,
  delta,
  deltaTone,
  fmtNum,
  lastPeriods,
  periodMetrics,
  summarize,
} from "@/lib/dashboard";
import KpiTile from "./KpiTile";
import LineChart from "./LineChart";

// Цвета рядов: проверены валидатором палитр (разделимы при дальтонизме); порядок фиксирован
const C1 = "#7658F6"; // фиолетовый — основной ряд
const C2 = "#eb6834"; // оранжевый
const C3 = "#1baf7a"; // зелёный (контраст на белом ниже 3:1 — есть легенда, подписи и таблица)

const RANGES = [
  { n: 0, label: "Все периоды" },
  { n: 6, label: "Последние 6" },
  { n: 3, label: "Последние 3" },
] as const;

function dayLabel(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

interface Props {
  businessId: string;
  businessName: string;
  snapshots: FunnelSnapshot[];
  progress: ProgressPoint[];
  target: GrowthTarget;
  /** Витрина на главной: вымышленные данные, без ссылок на ввод показателей. */
  demo?: boolean;
}

export default function BusinessDashboard({ businessId, businessName, snapshots, progress, target, demo = false }: Props) {
  const [range, setRange] = useState<number>(0);
  const allMetrics = useMemo(() => periodMetrics(snapshots), [snapshots]);
  const metrics = useMemo(() => lastPeriods(allMetrics, range), [allMetrics, range]);
  const { latest, previous, periods } = summarize(metrics);
  const insights = useMemo(() => buildInsights(metrics, progress), [metrics, progress]);

  const cats = metrics.map((m) => m.short);
  const full = metrics.map((m) => m.label);
  const nf = (n: number) => fmtNum(n, 1);
  const rub = (n: number) => `${fmtNum(n)} ₽`;
  const pc = (n: number) => `${fmtNum(n, 1)}%`;

  const goalLines = [
    target.leadsPerMonth ? { value: target.leadsPerMonth, label: "Цель по заявкам", color: C1 } : null,
    target.salesPerMonth ? { value: target.salesPerMonth, label: "Цель по продажам", color: C2 } : null,
  ].filter((x): x is { value: number; label: string; color: string } => x !== null);

  const hasCost = metrics.some((m) => m.costPerLead !== null || m.costPerSale !== null);
  const hasReviews = metrics.some((m) => m.reviewsCount !== null);
  const lastProgress = progress.length ? progress[progress.length - 1] : null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-violet">Дашборд · динамика</p>
          <h1 className="mt-1 font-display text-2xl text-ink-900 md:text-3xl">{businessName}</h1>
          <p className="mt-1 text-sm text-muted">
            {periods
              ? `${periods} ${periods === 1 ? "период" : periods < 5 ? "периода" : "периодов"} с показателями · цифры вносите вы сами`
              : "Показатели пока не внесены"}
          </p>
        </div>
        {demo ? (
          <span className="rounded-full bg-violet-soft px-4 py-2 text-xs font-bold text-violet">Демо · вымышленные данные</span>
        ) : (
          <Link
            href={`/business/${businessId}#analytics`}
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-ink-800"
          >
            Внести показатели
          </Link>
        )}
      </div>

      {allMetrics.length > 3 && (
        <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Период на дашборде">
          <span className="mr-1 text-xs text-muted">Период</span>
          {RANGES.map((r) => (
            <button
              key={r.n}
              type="button"
              onClick={() => setRange(r.n)}
              aria-pressed={range === r.n}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                range === r.n ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-white text-ink-900 hover:border-ink-900/40"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {!latest ? (
        <div className="rounded-2xl border border-dashed border-ink-900/20 bg-soft p-8 text-center">
          <h2 className="font-display text-lg text-ink-900">Здесь появится динамика</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Внесите обращения, заявки и продажи хотя бы за один период, а в следующие периоды добавляйте новые цифры: на дашборде
            появятся графики и сравнение с прошлым периодом.
          </p>
          <Link
            href={`/business/${businessId}#analytics`}
            className="mt-5 inline-block rounded-full bg-brand px-6 py-3 text-sm font-extrabold text-ink-900 transition-transform hover:-translate-y-0.5"
          >
            Внести первые показатели
          </Link>
        </div>
      ) : (
        <>
          <section aria-label="Главные показатели" className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiTile
              label={`Заявки · ${latest.label}`}
              value={fmtNum(latest.leads)}
              delta={previous ? delta(latest.leads, previous.leads) : null}
              tone={deltaTone(previous ? delta(latest.leads, previous.leads) : null)}
              hint="Со второго периода появится сравнение"
            />
            <KpiTile
              label="Продажи"
              value={fmtNum(latest.sales)}
              delta={previous ? delta(latest.sales, previous.sales) : null}
              tone={deltaTone(previous ? delta(latest.sales, previous.sales) : null)}
              hint="Со второго периода появится сравнение"
            />
            <KpiTile
              label="Обращения → заявки"
              value={latest.toLeads === null ? "—" : fmtNum(latest.toLeads, 1)}
              unit="%"
              delta={previous ? delta(latest.toLeads, previous.toLeads, "points") : null}
              tone={deltaTone(previous ? delta(latest.toLeads, previous.toLeads, "points") : null)}
              hint={latest.toLeads === null ? "Нужны обращения" : undefined}
            />
            <KpiTile
              label="Заявки → продажи"
              value={latest.toSales === null ? "—" : fmtNum(latest.toSales, 1)}
              unit="%"
              delta={previous ? delta(latest.toSales, previous.toSales, "points") : null}
              tone={deltaTone(previous ? delta(latest.toSales, previous.toSales, "points") : null)}
              hint={latest.toSales === null ? "Нужны заявки" : undefined}
            />
            <KpiTile
              label="Стоимость заявки"
              value={fmtNum(latest.costPerLead)}
              unit="₽"
              delta={previous ? delta(latest.costPerLead, previous.costPerLead) : null}
              tone={deltaTone(previous ? delta(latest.costPerLead, previous.costPerLead) : null, true)}
              hint="Укажите рекламный бюджет периода"
            />
            <KpiTile
              label="Оценочная выручка"
              value={fmtNum(latest.revenue)}
              unit="₽"
              delta={previous ? delta(latest.revenue, previous.revenue) : null}
              tone={deltaTone(previous ? delta(latest.revenue, previous.revenue) : null)}
              hint="Продажи × средний чек; укажите чек"
            />
          </section>

          {insights.length > 0 && (
            <ul className="mb-6 mt-4 space-y-1.5 rounded-xl border border-violet/20 bg-violet-soft p-4 text-sm text-ink-900">
              {insights.map((t) => (
                <li key={t} className="flex gap-2">
                  <span className="text-violet" aria-hidden>✦</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}

          {periods < 2 && (
            <p className="mb-4 rounded-xl bg-soft p-4 text-sm text-muted">
              Внесён один период — динамика появится, когда добавите следующий. Раз в месяц достаточно.
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <LineChart
              title="Заявки и продажи"
              subtitle={goalLines.length ? "Пунктир — ваша цель на месяц" : "Задать цель можно в блоке «Где вы теряете клиентов»"}
              categories={cats}
              fullLabels={full}
              format={nf}
              series={[
                { name: "Заявки", color: C1, values: metrics.map((m) => m.leads) },
                { name: "Продажи", color: C2, values: metrics.map((m) => m.sales) },
              ]}
              refLines={goalLines}
            />
            <LineChart
              title="Конверсии воронки"
              subtitle="Какая доля клиентов доходит до следующего шага"
              categories={cats}
              fullLabels={full}
              format={pc}
              series={[
                { name: "Обращения → заявки", color: C1, values: metrics.map((m) => m.toLeads) },
                { name: "Заявки → продажи", color: C2, values: metrics.map((m) => m.toSales) },
                { name: "Продажи → повторные", color: C3, values: metrics.map((m) => m.toRepeat) },
              ]}
            />
            <LineChart
              title="Обращения"
              subtitle="Визиты, звонки и сообщения за период"
              categories={cats}
              fullLabels={full}
              format={nf}
              series={[{ name: "Обращения", color: C1, values: metrics.map((m) => m.visitors) }]}
            />
            {hasCost ? (
              <LineChart
                title="Стоимость заявки и продажи, ₽"
                subtitle="Рекламный бюджет периода ÷ число заявок или продаж"
                categories={cats}
                fullLabels={full}
                format={rub}
                series={[
                  { name: "Заявка", color: C1, values: metrics.map((m) => m.costPerLead) },
                  { name: "Продажа", color: C2, values: metrics.map((m) => m.costPerSale) },
                ]}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-line bg-soft p-5 text-sm text-muted">
                <p className="mb-1 font-display text-base text-ink-900">Стоимость заявки и продажи</p>
                Укажите рекламный бюджет за период в дополнительных полях при внесении показателей — график появится сам.
              </div>
            )}
            {hasReviews && (
              <LineChart
                title="Отзывы на картах"
                subtitle={latest.reviewsRating ? `Рейтинг сейчас: ${fmtNum(latest.reviewsRating, 1)}` : undefined}
                categories={cats}
                fullLabels={full}
                format={(n) => fmtNum(n)}
                series={[{ name: "Отзывов", color: C3, values: metrics.map((m) => m.reviewsCount) }]}
              />
            )}
            <LineChart
              title="Выполнение плана, %"
              subtitle={
                lastProgress
                  ? `Сейчас выполнено ${lastProgress.total}% (${lastProgress.done} из ${lastProgress.steps} шагов)`
                  : "Отмечайте шаги в плане — динамика накапливается по дням"
              }
              categories={progress.map((p) => dayLabel(p.date))}
              fullLabels={progress.map((p) => dayLabel(p.date))}
              format={(n) => `${fmtNum(n)}%`}
              series={[
                { name: "Фундамент", color: C1, values: progress.map((p) => p.foundation) },
                { name: "Трафик", color: C2, values: progress.map((p) => p.traffic) },
                { name: "Удержание", color: C3, values: progress.map((p) => p.retention) },
              ]}
              emptyHint="История выполнения начнёт копиться с первого захода на страницу плана."
            />
          </div>

          <p className="mt-5 text-xs leading-relaxed text-muted">
            {demo ? "Это демонстрация на вымышленных данных. " : ""}Дашборд показывает только цифры, которые вы внесли, и не доказывает,
            что именно действие из плана дало рост: рядом лежат результаты и выполнение плана, выводы остаются за вами.
          </p>
        </>
      )}
    </div>
  );
}
