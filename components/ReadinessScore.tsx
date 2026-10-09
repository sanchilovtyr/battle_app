"use client";

import { useEffect, useState } from "react";
import { ChecklistState } from "@/lib/checklist";
import { FunnelSnapshot } from "@/lib/funnel";
import { GeneratedPlan } from "@/lib/types";
import { VectorId } from "@/lib/vectors";
import { computeReadiness } from "@/lib/readiness";

interface ReadinessScoreProps {
  businessId: string;
  plan: GeneratedPlan;
  checklist: ChecklistState;
  checklistAccess: boolean;
  vectorId?: VectorId | null;
  vectorAccess: boolean;
  snapshots: FunnelSnapshot[];
}

function levelKey(businessId: string) {
  return `promoplan_level_seen_${businessId}`;
}

/** Одна цифра прогресса вместо нескольких разрозненных блоков — насколько
 *  бизнес использует то, что даёт сервис (вектор, чек-лист, Метрика, воронка).
 *  Подключение к Метрике подтягиваем отдельным лёгким запросом, чтобы не
 *  тянуть его через все родительские компоненты. Уровень называем словом, а
 *  не только процентом — так прогресс ощущается как игровой, а не как сухая
 *  метрика, и при переходе на новый уровень один раз показываем поздравление. */
export default function ReadinessScore({
  businessId,
  plan,
  checklist,
  checklistAccess,
  vectorId,
  vectorAccess,
  snapshots,
}: ReadinessScoreProps) {
  const [metrikaConnected, setMetrikaConnected] = useState(false);
  const [metrikaReady, setMetrikaReady] = useState(false);
  const [justLeveledUp, setJustLeveledUp] = useState(false);

  useEffect(() => {
    if (!checklistAccess) {
      setMetrikaReady(true);
      return;
    }
    fetch(`/api/metrika/status?businessId=${businessId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMetrikaConnected(Boolean(data?.connected && data?.counterId)))
      .catch(() => {})
      .finally(() => setMetrikaReady(true));
  }, [businessId, checklistAccess]);

  const { pct, items, level } = computeReadiness({
    plan,
    checklist,
    checklistAccess,
    vectorId,
    vectorAccess,
    snapshots,
    metrikaConnected,
  });

  useEffect(() => {
    // Ждём, пока статус Метрики не подтянется — иначе временный переход
    // "без Метрики → с Метрикой" при каждой загрузке страницы засчитывался бы
    // как смена уровня, хотя пользователь ничего не делал.
    if (!metrikaReady) return;
    try {
      const key = levelKey(businessId);
      const lastSeen = window.localStorage.getItem(key);
      if (lastSeen !== null && lastSeen !== level) {
        setJustLeveledUp(true);
        const t = setTimeout(() => setJustLeveledUp(false), 4000);
        window.localStorage.setItem(key, level);
        return () => clearTimeout(t);
      }
      window.localStorage.setItem(key, level);
    } catch {
      // localStorage недоступен — просто не показываем поздравление
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, level, metrikaReady]);

  return (
    <div className="rounded-2xl border border-line bg-white p-5 md:p-6">
      <div className="mb-1 flex items-center justify-between gap-4">
        <h3 className="font-display text-lg text-ink-900">Индекс готовности маркетинга</h3>
        <span className="font-display text-2xl text-violet">{pct}%</span>
      </div>
      <p className="mb-4 text-sm font-medium text-violet">
        Уровень: {level}
        {justLeveledUp && (
          <span className="ml-2 inline-block rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-ink-900 animate-pulse">
            Новый уровень! 🎉
          </span>
        )}
      </p>
      <div className="mb-4 h-2 rounded-full bg-soft">
        <div className="h-2 rounded-full bg-violet transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span className={item.done ? "text-violet" : "text-ink-900/25"}>{item.done ? "✓" : "○"}</span>
            <span className={item.done ? "text-ink-900" : "text-muted"}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
