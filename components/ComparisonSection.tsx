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
    us: "По 7 ответам + вектору аудитории",
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

export default function ComparisonSection() {
  return (
    <div className="mx-auto max-w-5xl">
      {/* Десктоп и планшет — полная таблица */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-muted"> </th>
              {OPTIONS.map((o) =>
                o.highlight ? (
                  <th
                    key={o.key}
                    className="rounded-t-xl border border-b-0 border-violet bg-ink-900 p-3.5 text-left text-white"
                  >
                    {o.name}
                  </th>
                ) : (
                  <th key={o.key} className="p-3.5 text-left font-medium text-ink-900">
                    {o.name}
                  </th>
                )
              )}
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
                  <td
                    className={`border-x border-violet bg-violet-soft p-3.5 font-medium text-ink-900 ${
                      isLast ? "rounded-b-xl border-b" : ""
                    }`}
                  >
                    {row.us}
                  </td>
                  <td className="border-t border-line p-3.5 text-muted">{row.agency}</td>
                  <td className="border-t border-line p-3.5 text-muted">{row.freelancer}</td>
                  <td className="border-t border-line p-3.5 text-muted">{row.nothing}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Мобильный — карточки, по одной на вариант, со свайпом */}
      <div className="md:hidden">
        <div className="scrollbar-hide -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-5 pb-2">
          {OPTIONS.map((o) => (
            <article
              key={o.key}
              className={`w-[84%] shrink-0 snap-start rounded-2xl border p-5 ${
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
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted">← Смахните, чтобы сравнить остальные варианты →</p>
      </div>
    </div>
  );
}
