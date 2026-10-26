"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BusinessDashboard from "@/components/dashboard/BusinessDashboard";
import { useBusiness } from "@/components/business/BusinessContext";
import { ProgressPoint, getProgressHistory } from "@/lib/progressHistory";
import { getGrowthTarget, GrowthTarget } from "@/lib/growthTarget";

export default function DashboardPage() {
  const { business, planMeta, snapshots, checklist, targetKey } = useBusiness();
  const [progress, setProgress] = useState<ProgressPoint[]>([]);
  const [target, setTarget] = useState<GrowthTarget>({});

  // контекст уже записал сегодняшнюю точку прогресса; перечитываем историю при изменении чек-листа
  useEffect(() => {
    if (!business) return;
    setProgress(getProgressHistory(business.id));
    setTarget(getGrowthTarget(business.id));
  }, [business, checklist, targetKey]);

  if (!business || !business.plan) return null;

  if (!planMeta.checklistAccess) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="mb-2 font-display text-2xl text-ink-900">Дашборд доступен на тарифах «Бизнес» и «Премиум»</h1>
        <p className="mb-6 text-muted">
          Он собирает ваши показатели и выполнение плана в графики и показывает динамику от периода к периоду.
        </p>
        <Link href="/#pricing" className="inline-block rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-800">
          Посмотреть тарифы
        </Link>
      </div>
    );
  }

  return (
    <BusinessDashboard
      businessId={business.id}
      businessName={business.name}
      snapshots={snapshots}
      progress={progress}
      target={target}
    />
  );
}
