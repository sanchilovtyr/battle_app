"use client";

import { useState } from "react";

const ROWS: { label: string; us: string; agency: string; freelancer: string; nothing: string }[] = [
  {
    label: "Цена в месяц",
    us: "от 1 990 ₽",
    agency: "от 60 000 ₽",
    freelancer: "от 80 000 ₽ + время на поиск",
    nothing: "0 ₽",
  },
  {
    label: "Когда будет готов план",
    us: "Сразу, за 3 минуты",
    agency: "1–3 недели на брифы и согласования",
    freelancer: "Недели на поиск и адаптацию человека",
    nothing: "Никогда",
  },
  {
    label: "Персонализация под нишу",
    us: "По 4 ответам о вашем бизнесе",
    agency: "Зависит от команды и брифа",
    freelancer: "Зависит от опыта конкретного человека",
    nothing: "—",
  },
  {
    label: "Нужно ли нанимать и управлять",
    us: "Нет",
    agency: "Нужно согласовывать и контролировать",
    freelancer: "Нужен найм, адаптация, контроль",
    nothing: "Нет",
  },
  {
    label: "Риск при уходе исполнителя",
    us: "Нет — план остаётся у вас",
    agency: "Смена менеджера — начинай объяснять заново",
    freelancer: "Уволился — начинай с нуля",
    nothing: "—",
  },
  {
    label: "Что происходит с продвижением",
    us: "Чек-лист, аналитика и обновления плана",
    agency: "Отчёты по договору, не всегда факты",
    freelancer: "Зависит от загрузки одного человека",
    nothing: "Конкуренты постепенно забирают клиентов",
  },
];

const OPTIONS = [
  { key: "us" as const, name: "Ключевое слово", highlight: true },
  { key: "agency" as const, name: "Маркетинговое агентство" },
  { key: "freelancer" as const, name: "Свой маркетолог / фрилансер" },
  { key: "nothing" as const, name: "Ничего не делать" },
];

type ColKey = (typeof OPTIONS)[number]["key"];

export default function ComparisonSection() {
  // Выделен тот столбец, на который наведён курсор; если курсора нет — выбранный
  // кликом; если не выбран ничего — «Ключевое слово»
  const [hovered, setHovered] = useState<ColKey | null>(null);
  const [selected, setSelected] = useState<ColKey | null>(null);
  const active: ColKey = hovered ?? selected ?? "us";
  const colProps = (k: ColKey) => ({
    onMouseEnter: () => setHovered(k),
    onMouseLeave: () => setHovered(null),
    onClick: () => setSelected((cur) => (cur === k ? null : k)),
  });

  return (
    <div className="mx-auto max-w-5xl">
      {/* Десктоп и планшет — полная таблица */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-muted"> </th>
              {OPTIONS.map((o) => (
                <th
                  key={o.key}
                  {...colProps(o.key)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected((cur) => (cur === o.key ? null : o.key));
                    }
                  }}
                  className={`cursor-pointer p-3.5 text-left transition-colors duration-200 ${
                    active === o.key
                      ? "rounded-t-xl border border-b-0 border-violet bg-ink-900 text-white"
                      : "border border-b-0 border-transparent font-medium text-ink-900"
                  }`}
                >
                  {o.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => {
              const isLast = i === ROWS.length - 1;
              return (
                <tr key={row.label}>
                  <th scope="row" className="border-t border-line p-3.5 text-left text-sm font-medium text-ink-900">
                    {row.label}
                  </th>
                  {OPTIONS.map((o) => {
                    const on = active === o.key;
                    return (
                      <td
                        key={o.key}
                        {...colProps(o.key)}
                        className={`cursor-pointer p-3.5 transition-colors duration-200 ${
                          on
                            ? `border-x border-t border-x-violet border-t-violet/15 bg-violet-soft font-medium text-ink-900 ${isLast ? "rounded-b-xl border-b border-b-violet" : ""}`
                            : "border-x border-t border-x-transparent border-t-line text-muted"
                        }`}
                      >
                        {row[o.key]}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Мобильный — карточки на весь экран, по одной на вариант, со свайпом */}
      <div className="md:hidden">
        <div className="scrollbar-hide -mx-5 flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-2">
          {OPTIONS.map((o) => (
            <div key={o.key} className="w-full shrink-0 snap-start px-5">
              <article
                className={`rounded-2xl border p-5 ${
                  o.highlight ? "border-violet bg-violet-soft" : "border-line bg-white"
                }`}
              >
                <h3
                  className={`mb-4 inline-block rounded-full px-3 py-1 font-display text-base ${
                    o.highlight ? "bg-ink-900 text-white" : "text-ink-900"
                  }`}
                >
                  {o.name}
                </h3>
                <dl className="space-y-3">
                  {ROWS.map((row) => (
                    <div key={row.label} className="border-t border-ink-900/10 pt-3 first:border-t-0 first:pt-0">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{row.label}</dt>
                      <dd className="mt-0.5 text-sm text-ink-900">{row[o.key]}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted">← Смахните, чтобы сравнить остальные варианты →</p>
      </div>
    </div>
  );
}
