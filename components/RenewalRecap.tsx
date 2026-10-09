import { Business } from "@/lib/account";
import { getChecklist, planProgress } from "@/lib/checklist";
import { getSnapshots } from "@/lib/funnel";
import { computeReadiness } from "@/lib/readiness";

interface RenewalRecapProps {
  businesses: Business[];
  checklistAccess: boolean;
  vectorAccess: boolean;
  daysLeft: number;
  renewDate: string;
}

/** Короткая карточка-напоминание перед списанием за продление подписки:
 *  что уже сделано, а не абстрактное "у вас скоро спишутся деньги". Показывает
 *  ценность подписки в момент, когда человек решает, продлевать её или нет —
 *  а не когда решение уже принято. Считается на клиенте из тех же локальных
 *  данных, что и остальные карточки прогресса. */
export default function RenewalRecap({ businesses, checklistAccess, vectorAccess, daysLeft, renewDate }: RenewalRecapProps) {
  const withPlan = businesses.filter((b) => b.plan);
  if (withPlan.length === 0) return null;

  const readinessResults = withPlan.map((b) =>
    computeReadiness({
      plan: b.plan!,
      checklist: getChecklist(b.id),
      checklistAccess,
      vectorId: b.vectorId,
      vectorAccess,
      snapshots: getSnapshots(b.id),
      metrikaConnected: false, // упрощение для этой сводки — точный статус смотрите в карточке бизнеса
    })
  );
  const avgPct = Math.round(readinessResults.reduce((sum, r) => sum + r.pct, 0) / readinessResults.length);

  let checklistDone = 0;
  let checklistTotal = 0;
  let businessesWithData = 0;
  if (checklistAccess) {
    for (const b of withPlan) {
      const progress = planProgress(getChecklist(b.id), b.plan!);
      checklistDone += progress.done;
      checklistTotal += progress.total;
      if (getSnapshots(b.id).length > 0) businessesWithData += 1;
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-violet/30 bg-violet/5 p-6">
      <p className="mb-1 text-xs font-mono uppercase tracking-wide text-violet">
        Продление через {daysLeft} {daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"} · {renewDate}
      </p>
      <h2 className="font-display text-lg text-ink-900 mb-3">Что вы уже получили от подписки</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-3.5">
          <p className="font-display text-2xl text-violet">{avgPct}%</p>
          <p className="text-xs text-muted">
            {withPlan.length === 1 ? "средняя готовность плана" : `средняя готовность по ${withPlan.length} бизнесам`}
          </p>
        </div>
        {checklistAccess && (
          <>
            <div className="rounded-xl bg-white p-3.5">
              <p className="font-display text-2xl text-violet">
                {checklistTotal ? `${checklistDone}/${checklistTotal}` : "—"}
              </p>
              <p className="text-xs text-muted">пунктов чек-листа выполнено</p>
            </div>
            <div className="rounded-xl bg-white p-3.5">
              <p className="font-display text-2xl text-violet">{businessesWithData}</p>
              <p className="text-xs text-muted">
                {businessesWithData === 1 ? "бизнес ведёт" : "бизнеса(ов) ведут"} учёт показателей
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
