import { DEMO_PLAN, DEMO_CHECKLIST, DEMO_SNAPSHOTS } from "@/lib/demoData";
import { phaseProgress } from "@/lib/checklist";
import { pct } from "@/lib/dashboard";

/** Витрина блока «Где вы теряете клиентов» на вымышленных данных (настоящий блок читает данные пользователя). */
export default function FunnelDemo() {
  const s = DEMO_SNAPSHOTS[DEMO_SNAPSHOTS.length - 1];
  const stages = [
    { key: "toLeads", label: "Обращения → заявки", value: pct(s.leads, s.visitors) },
    { key: "toSales", label: "Заявки → продажи", value: pct(s.sales, s.leads) },
    { key: "toRepeat", label: "Продажи → повторные", value: pct(s.repeat, s.sales) },
  ];
  const weak = stages.reduce((m, x) => (x.value! < m.value! ? x : m), stages[0]);
  const phases = [
    { label: "Фундамент", p: phaseProgress(DEMO_CHECKLIST, DEMO_PLAN.foundation) },
    { label: "Трафик", p: phaseProgress(DEMO_CHECKLIST, DEMO_PLAN.traffic) },
    { label: "Удержание", p: phaseProgress(DEMO_CHECKLIST, DEMO_PLAN.retention) },
  ];
  const cells = [
    { label: "Обращения", value: s.visitors },
    { label: "Заявки", value: s.leads },
    { label: "Продажи", value: s.sales },
    { label: "Повторные", value: s.repeat },
  ];
  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-ink-900">Где вы теряете клиентов</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-soft px-3 py-1 text-xs font-bold text-violet">🔥 6 месяцев подряд</span>
      </div>
      <p className="mb-5 text-sm text-muted">
        Вы вносите цифры раз в период. По ним и по выполненным пунктам плана мы показываем, на каком шаге воронки клиенты отваливаются чаще всего.
      </p>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {phases.map(({ label, p }) => (
          <div key={label} className="rounded-xl bg-soft p-3.5">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-ink-900">{label}</span>
              <span className="text-muted">{p.total ? `${p.done}/${p.total}` : "—"}</span>
            </div>
            <div className="h-1.5 rounded-full bg-line">
              <div className="h-1.5 rounded-full bg-violet" style={{ width: `${p.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mb-3 text-sm font-medium text-ink-900">{s.label}</p>
      <div className="mb-6 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {cells.map((c, i) => (
          <div key={c.label} className="rounded-xl border border-line p-3">
            <p className="font-display text-xl text-ink-900">{c.value}</p>
            <p className="mt-0.5 text-xs text-muted">{c.label}</p>
            {i > 0 && (
              <p className={`mt-1 text-xs font-medium ${weak.key === stages[i - 1].key ? "text-amber-700" : "text-muted"}`}>{stages[i - 1].value}%</p>
            )}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="font-medium text-amber-900">Больше всего клиентов теряется на входе — обращения не превращаются в заявки</p>
        <p className="mt-1.5 text-sm text-amber-800">
          Обычно это значит, что сайт или объявление не убеждают оставить контакт: непонятно предложение, нет цены или неудобно написать. Это зона этапа «Фундамент» вашего плана.
        </p>
      </div>
    </section>
  );
}
