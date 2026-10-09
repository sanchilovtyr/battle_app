import { DEMO_BUSINESS, DEMO_READINESS } from "@/lib/demoData";

/** Витрина личного кабинета: тариф, бизнес и индекс готовности (вымышленные данные). */
export default function AccountDemo() {
  const r = DEMO_READINESS;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg text-ink-900">Ваши бизнесы</h2>
          <span className="rounded-full bg-ink-900 px-3 py-1 text-xs font-bold text-brand">Тариф «Бизнес»</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-soft p-4">
          <div>
            <p className="font-medium text-ink-900">{DEMO_BUSINESS.name}</p>
            <p className="text-sm text-muted">{DEMO_BUSINESS.businessType} · план от 2 апреля 2026 г.</p>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-violet">
            <span className="underline underline-offset-4">Дашборд</span>
            <span className="underline underline-offset-4">Открыть план</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">1 из 3 бизнесов · данные доступны при входе с любого устройства</p>
      </div>
      <div className="rounded-2xl border border-line bg-white p-5 md:p-6">
        <div className="mb-1 flex items-center justify-between gap-4">
          <h3 className="font-display text-lg text-ink-900">Индекс готовности маркетинга</h3>
          <span className="font-display text-2xl text-violet">{r.pct}%</span>
        </div>
        <p className="mb-4 text-sm font-medium text-violet">Уровень: {r.level}</p>
        <div className="mb-4 h-2 rounded-full bg-soft">
          <div className="h-2 rounded-full bg-violet" style={{ width: `${r.pct}%` }} />
        </div>
        <ul className="space-y-1.5">
          {r.items.map((item) => (
            <li key={item.label} className="flex items-center gap-2 text-sm">
              <span className={item.done ? "text-violet" : "text-ink-900/25"}>{item.done ? "✓" : "○"}</span>
              <span className={item.done ? "text-ink-900" : "text-muted"}>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
