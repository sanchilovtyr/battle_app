"use client";

import Link from "next/link";
import UnitEconomics from "@/components/unit/UnitEconomics";
import { useBusiness } from "@/components/business/BusinessContext";
import { useCloudSync } from "@/lib/useCloudSync";

export default function UnitEconomicsPage() {
  const { business, planMeta, snapshots } = useBusiness();
  const { tick } = useCloudSync();

  if (!business || !business.plan) return null;

  if (!planMeta.unitEconomicsAccess) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="mb-2 font-display text-2xl text-ink-900">Юнит-экономика доступна на тарифе «Премиум»</h1>
        <p className="mb-6 text-muted">
          Считает цену привлечения клиента, прибыль с него и окупаемость рекламы. Данные подставляются из воронки и CRM, а ползунки «что если» показывают, как изменятся итоги.
        </p>
        <Link href="/#pricing" className="inline-block rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-800">
          Посмотреть тарифы
        </Link>
      </div>
    );
  }

  return <UnitEconomics businessId={business.id} businessName={business.name} snapshots={snapshots} syncTick={tick} />;
}
