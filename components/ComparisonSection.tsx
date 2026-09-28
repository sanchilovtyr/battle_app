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

export default function ComparisonSection() {
  return (
    <div className="mx-auto max-w-5xl overflow-x-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="p-3 text-left text-xs font-medium uppercase tracking-wide text-muted"> </th>
            <th className="rounded-t-xl border border-b-0 border-violet bg-ink-900 p-3.5 text-left text-white">
              Ключевое слово
            </th>
            <th className="p-3.5 text-left font-medium text-ink-900">Маркетинговое агентство</th>
            <th className="p-3.5 text-left font-medium text-ink-900">Свой маркетолог / фрилансер</th>
            <th className="p-3.5 text-left font-medium text-ink-900">Ничего не делать</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, i) => {
            const isLast = i === ROWS.length - 1;
            return (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="border-t border-line p-3.5 text-left text-sm font-medium text-ink-900"
                >
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
  );
}
