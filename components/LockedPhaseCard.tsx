import { PHASE_META } from "@/components/PlanColumn";

/** Заглушка вместо этапа "Удержание" для тарифов без fullPlanAccess — показывает,
 *  что там есть, а не просто молча прячет колонку. */
export default function LockedPhaseCard() {
  const meta = PHASE_META.retention;
  return (
    <div className="print:hidden mb-10 rounded-xl border border-dashed border-ink-900/20 bg-soft p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-brand">
        🔒
      </div>
      <h3 className="font-display text-lg text-ink-900 mb-1.5">{meta.title}</h3>
      <p className="mx-auto mb-4 max-w-md text-sm text-muted">
        На пробном тарифе этот этап скрыт. Оформите платную подписку, чтобы открыть удержание
        клиентов и повторные продажи — вместе с чек-листами и обновлениями плана.
      </p>
      <a
        href="/#pricing"
        className="inline-block rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-800"
      >
        Открыть все этапы
      </a>
    </div>
  );
}
