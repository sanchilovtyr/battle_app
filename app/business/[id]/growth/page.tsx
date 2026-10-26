"use client";

import GrowthPoints, { LockedGrowthPoints } from "@/components/GrowthPoints";
import { useBusiness } from "@/components/business/BusinessContext";
import { getGrowthTarget } from "@/lib/growthTarget";

export default function GrowthPage() {
  const { business, planMeta, checklist, snapshots } = useBusiness();
  if (!business || !business.plan) return null;

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-ink-900 md:text-3xl">Точки роста компании</h1>
      <p className="mb-6 text-sm text-muted">Что даст наибольший прирост в ближайшее время — по вашему плану и показателям.</p>
      {planMeta.growthPointsAccess ? (
        <GrowthPoints
          businessId={business.id}
          plan={business.plan}
          checklist={checklist}
          snapshots={snapshots}
          target={getGrowthTarget(business.id)}
        />
      ) : (
        <LockedGrowthPoints />
      )}
    </div>
  );
}
