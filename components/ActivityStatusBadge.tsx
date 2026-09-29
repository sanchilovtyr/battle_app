import { FunnelSnapshot, streakMonths } from "@/lib/funnel";
import { activityStatus } from "@/lib/activityStatus";

interface ActivityStatusBadgeProps {
  snapshots: FunnelSnapshot[];
}

/** Небольшой значок статуса по регулярности внесения показателей — виден,
 *  только когда есть хотя бы один месяц данных, чтобы не показывать пустой
 *  статус тем, кто ещё не начал. */
export default function ActivityStatusBadge({ snapshots }: ActivityStatusBadgeProps) {
  const streak = streakMonths(snapshots);
  const status = activityStatus(streak);
  if (!status) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-soft px-3 py-1.5 text-xs font-bold text-violet">
      <span>{status.icon}</span>
      {status.label}
      <span className="text-violet/70">
        · {streak} {streak === 1 ? "месяц" : streak < 5 ? "месяца" : "месяцев"} подряд
      </span>
    </span>
  );
}
