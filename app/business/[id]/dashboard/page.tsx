"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SiteHeader from "@/components/SiteHeader";
import BusinessDashboard from "@/components/dashboard/BusinessDashboard";
import { getBusiness, Business } from "@/lib/account";
import { getPlan, PlanId } from "@/lib/plans";
import { computeEffectivePlanId } from "@/lib/subscriptionUtils";
import { getChecklist } from "@/lib/checklist";
import { FunnelSnapshot, getSnapshots } from "@/lib/funnel";
import { getGrowthTarget, GrowthTarget } from "@/lib/growthTarget";
import { ProgressPoint, getProgressHistory, recordProgress } from "@/lib/progressHistory";
import { useCloudSync } from "@/lib/useCloudSync";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">{children}</div>
    </main>
  );
}

function Message({ title, text, href, cta }: { title: string; text: string; href: string; cta: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="mb-2 font-display text-2xl text-ink-900">{title}</h1>
      <p className="mb-6 text-muted">{text}</p>
      <Link href={href} className="inline-block rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-800">
        {cta}
      </Link>
    </div>
  );
}

export default function DashboardPage({ params }: { params: { id: string } }) {
  const { status } = useSession();
  const { ready: cloudReady, tick: cloudTick } = useCloudSync();
  const [loaded, setLoaded] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [planId, setPlanId] = useState<PlanId>("trial");
  const [snapshots, setSnapshots] = useState<FunnelSnapshot[]>([]);
  const [progress, setProgress] = useState<ProgressPoint[]>([]);
  const [target, setTarget] = useState<GrowthTarget>({});

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setLoaded(true);
      return;
    }
    if (!cloudReady) return; // данные ещё подтягиваются с сервера
    const b = getBusiness(params.id);
    setBusiness(b);
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const effective = computeEffectivePlanId(data?.subscription ?? null);
        setPlanId(effective);
        if (b) {
          setSnapshots(getSnapshots(b.id));
          setTarget(getGrowthTarget(b.id));
          // фиксируем сегодняшний прогресс, чтобы у графика была точка отсчёта
          setProgress(
            b.plan && getPlan(effective).checklistAccess
              ? recordProgress(b.id, b.plan, getChecklist(b.id))
              : getProgressHistory(b.id)
          );
        }
      })
      .finally(() => setLoaded(true));
  }, [status, params.id, cloudReady, cloudTick]);

  if (status === "loading" || !loaded) return <Shell>{null}</Shell>;

  if (status !== "authenticated") {
    return (
      <Shell>
        <Message title="Личный кабинет" text="Войдите, чтобы открыть дашборд." href="/account" cta="Личный кабинет" />
      </Shell>
    );
  }

  if (!business || !business.plan) {
    return (
      <Shell>
        <Message
          title="Бизнес не найден"
          text="Возможно, бизнес удалён или открыт в другом браузере: списки бизнесов и показатели пока хранятся в браузере, где план был создан."
          href="/account"
          cta="Личный кабинет"
        />
      </Shell>
    );
  }

  if (!getPlan(planId).checklistAccess) {
    return (
      <Shell>
        <Message
          title="Дашборд доступен на тарифах «Бизнес» и «Премиум»"
          text="Он собирает ваши показатели и выполнение плана в графики и показывает динамику от периода к периоду."
          href="/#pricing"
          cta="Посмотреть тарифы"
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <Link href={`/business/${business.id}`} className="mb-5 inline-block text-sm text-muted underline underline-offset-4 hover:text-ink-900">
        ← План бизнеса
      </Link>
      <BusinessDashboard
        businessId={business.id}
        businessName={business.name}
        snapshots={snapshots}
        progress={progress}
        target={target}
      />
    </Shell>
  );
}
