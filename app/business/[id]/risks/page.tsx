"use client";

import Link from "next/link";
import RisksManager from "@/components/risks/RisksManager";
import { useBusiness } from "@/components/business/BusinessContext";
import { useCloudSync } from "@/lib/useCloudSync";

export default function RisksPage() {
  const { business, planMeta, snapshots } = useBusiness();
  const { tick } = useCloudSync();

  if (!business || !business.plan) return null;

  if (!planMeta.risksAccess) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="mb-2 font-display text-2xl text-ink-900">Управление рисками доступно на тарифе «Премиум»</h1>
        <p className="mb-6 text-muted">
          Внешние угрозы для вашего бизнеса: новые законы, ход конкурентов, ограничения на поставки, изменения в экономике. Оценка, тепловая карта, план Б, напоминания о проверках и расчёт запаса прочности прибыли.
        </p>
        <Link href="/#pricing" className="inline-block rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-800">
          Посмотреть тарифы
        </Link>
      </div>
    );
  }

  return <RisksManager businessId={business.id} businessName={business.name} businessType={business.plan.answers?.businessType ?? business.businessType} snapshots={snapshots} syncTick={tick} />;
}
