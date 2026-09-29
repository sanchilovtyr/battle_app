import { GeneratedPlan } from "@/lib/types";
import { VectorId } from "@/lib/vectors";
import { computeReadiness } from "@/lib/readiness";

interface GuestReadinessTeaserProps {
  plan: GeneratedPlan;
  vectorId?: VectorId | null;
}

const LOCKED_FEATURES = [
  "Чек-лист выполнения",
  "Точки роста",
  "Аналитика и Метрика",
  "Экспорт в PDF",
];

/** То же "Индекс готовности", что видит зарегистрированный пользователь, но
 *  для гостя — до регистрации. Показывает честный процент (обычно невысокий,
 *  без чек-листа и данных) и явно запертые бейджи того, что откроется дальше
 *  — вместо того, чтобы прогресс был виден только после регистрации. */
export default function GuestReadinessTeaser({ plan, vectorId }: GuestReadinessTeaserProps) {
  const { pct, level } = computeReadiness({
    plan,
    checklist: {},
    checklistAccess: false,
    vectorId,
    snapshots: [],
    metrikaConnected: false,
  });

  return (
    <div className="mb-8 rounded-2xl border border-violet/20 bg-violet-soft/40 p-5 md:p-6">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h3 className="font-display text-lg text-ink-900">Индекс готовности маркетинга</h3>
        <span className="font-display text-2xl text-violet">{pct}%</span>
      </div>
      <p className="mb-4 text-sm font-medium text-violet">Уровень: {level}</p>
      <div className="mb-4 h-2 rounded-full bg-white">
        <div className="h-2 rounded-full bg-violet transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
        Откроется на платных тарифах
      </p>
      <div className="flex flex-wrap gap-2">
        {LOCKED_FEATURES.map((f) => (
          <span
            key={f}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink-900/50"
          >
            🔒 {f}
          </span>
        ))}
      </div>
    </div>
  );
}
