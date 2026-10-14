"use client";

import Link from "next/link";
import ClientsCrm from "@/components/crm/ClientsCrm";
import { useBusiness } from "@/components/business/BusinessContext";
import { useCloudSync } from "@/lib/useCloudSync";
import { parsePrice } from "@/lib/crmCore";

export default function ClientsPage() {
  const { business, planMeta } = useBusiness();
  const { tick } = useCloudSync();

  if (!business || !business.plan) return null;

  if (!planMeta.checklistAccess) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <h1 className="mb-2 font-display text-2xl text-ink-900">CRM доступна на тарифах «Бизнес» и «Премиум»</h1>
        <p className="mb-6 text-muted">
          Здесь вы записываете клиентов и оплаты, а сервис показывает выручку, конверсию, источники и то, сколько клиентов принёс план.
        </p>
        <Link href="/#pricing" className="inline-block rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-800">
          Посмотреть тарифы
        </Link>
      </div>
    );
  }

  return <ClientsCrm businessId={business.id} businessName={business.name} monthlyPlanPrice={parsePrice(planMeta.price)} syncTick={tick} />;
}
