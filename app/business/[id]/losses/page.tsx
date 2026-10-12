"use client";

import PlanAnalytics, { LockedAnalytics } from "@/components/PlanAnalytics";
import { useBusiness } from "@/components/business/BusinessContext";

export default function LossesPage() {
  const { business, planMeta, checklist, snapshots, setSnapshots, targetKey } = useBusiness();
  if (!business || !business.plan) return null;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-ink-900 md:text-3xl">Где вы теряете клиентов</h1>
      <p className="mb-6 text-sm text-muted">
        Введите показатели воронки — калькулятор покажет, на каком шаге уходит больше всего людей и сколько это стоит.
      </p>
      {planMeta.checklistAccess ? (
        <PlanAnalytics
          key={`${business.id}-${targetKey}`}
          businessId={business.id}
          plan={business.plan}
          checklist={checklist}
          snapshots={snapshots}
          onSnapshotsChange={setSnapshots}
        />
      ) : (
        <LockedAnalytics />
      )}
    </div>
  );
}
