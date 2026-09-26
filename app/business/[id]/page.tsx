"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import SiteHeader from "@/components/SiteHeader";
import VectorSection from "@/components/VectorSection";
import PlanColumn from "@/components/PlanColumn";
import PlanAnalytics, { LockedAnalytics } from "@/components/PlanAnalytics";
import { getBusiness, Business } from "@/lib/account";
import { getPlan, PlanId } from "@/lib/plans";
import { computeEffectivePlanId } from "@/lib/subscriptionUtils";
import { ChecklistState, getChecklist, toggleStep } from "@/lib/checklist";
import { FunnelSnapshot, getSnapshots } from "@/lib/funnel";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function BusinessPage({ params }: { params: { id: string } }) {
  const { status } = useSession();
  const [dataLoaded, setDataLoaded] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [effectivePlanId, setEffectivePlanId] = useState<PlanId>("trial");
  const [checklist, setChecklist] = useState<ChecklistState>({});
  const [snapshots, setSnapshots] = useState<FunnelSnapshot[]>([]);

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingPdf, setSendingPdf] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setDataLoaded(true);
      return;
    }
    const b = getBusiness(params.id);
    setBusiness(b);
    if (b) {
      setChecklist(getChecklist(b.id));
      setSnapshots(getSnapshots(b.id));
    }
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setEffectivePlanId(computeEffectivePlanId(data?.subscription ?? null)))
      .finally(() => setDataLoaded(true));
  }, [status, params.id]);

  const planMeta = getPlan(effectivePlanId);

  const handleToggleStep = (moduleId: string, stepIndex: number, stepsLength: number) => {
    if (!business) return;
    setChecklist(toggleStep(business.id, moduleId, stepIndex, stepsLength));
  };

  const downloadPdf = async () => {
    if (!business?.plan) return;
    setPdfNotice(null);
    setDownloadingPdf(true);
    try {
      const res = await fetch("/api/plan/download-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: business.name, plan: business.plan }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPdfNotice(data.error || "Не удалось скачать PDF, попробуйте ещё раз.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plan.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setPdfNotice("Не удалось связаться с сервером, попробуйте ещё раз.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const emailPdf = async () => {
    if (!business?.plan) return;
    setSendingPdf(true);
    setPdfNotice(null);
    try {
      const res = await fetch("/api/plan/email-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: business.name, plan: business.plan }),
      });
      const data = await res.json().catch(() => ({}));
      setPdfNotice(res.ok ? "PDF отправлен на почту." : data.error || "Не удалось отправить PDF.");
    } catch {
      setPdfNotice("Не удалось связаться с сервером, попробуйте ещё раз.");
    } finally {
      setSendingPdf(false);
    }
  };

  if (status === "loading" || !dataLoaded) {
    return (
      <main>
        <SiteHeader />
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main>
        <SiteHeader />
        <div className="mx-auto max-w-md px-5 py-24 text-center md:px-8">
          <h1 className="font-display text-2xl text-ink-900 mb-2">Личный кабинет</h1>
          <p className="text-muted mb-6">Войдите, чтобы посмотреть план бизнеса.</p>
          <Link
            href="/account"
            className="inline-block rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-800"
          >
            Личный кабинет
          </Link>
        </div>
      </main>
    );
  }

  if (!business || !business.plan) {
    return (
      <main>
        <SiteHeader />
        <div className="mx-auto max-w-md px-5 py-24 text-center md:px-8">
          <h1 className="font-display text-2xl text-ink-900 mb-2">План не найден</h1>
          <p className="text-muted mb-6">
            {business
              ? "Этот бизнес создан до того, как планы стали сохраняться — постройте план заново."
              : "Возможно, бизнес был удалён или открыт в другом браузере — списки бизнесов пока хранятся локально в браузере, где план был создан."}
          </p>
          <Link
            href="/account"
            className="inline-block rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-800"
          >
            Личный кабинет
          </Link>
        </div>
      </main>
    );
  }

  const plan = business.plan;

  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <Link href="/account" className="text-sm text-muted underline underline-offset-4 hover:text-ink-900">
          ← Личный кабинет
        </Link>

        <div className="mt-4 mb-8 rounded-xl border border-violet/30 bg-violet/5 p-5 md:p-6">
          <p className="text-xs font-mono uppercase tracking-wide text-violet mb-2">
            {business.name} · план от {formatDate(business.createdAt)}
          </p>
          <p className="font-display text-lg md:text-xl text-ink-900">{plan.summary}</p>
        </div>

        <PlanColumn
          phase="foundation"
          entries={plan.foundation}
          checklist={planMeta.checklistAccess ? checklist : undefined}
          onToggleStep={planMeta.checklistAccess ? handleToggleStep : undefined}
        />
        <PlanColumn
          phase="traffic"
          entries={plan.traffic}
          checklist={planMeta.checklistAccess ? checklist : undefined}
          onToggleStep={planMeta.checklistAccess ? handleToggleStep : undefined}
        />
        {planMeta.fullPlanAccess && (
          <PlanColumn
            phase="retention"
            entries={plan.retention}
            checklist={planMeta.checklistAccess ? checklist : undefined}
            onToggleStep={planMeta.checklistAccess ? handleToggleStep : undefined}
          />
        )}

        {planMeta.checklistAccess ? (
          <PlanAnalytics
            businessId={business.id}
            plan={plan}
            checklist={checklist}
            snapshots={snapshots}
            onSnapshotsChange={setSnapshots}
          />
        ) : (
          <LockedAnalytics />
        )}

        {planMeta.audienceVectorAccess && <VectorSection />}

        {planMeta.pdfExportAccess && (
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">Скачайте план или получите его на почту.</p>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                onClick={downloadPdf}
                disabled={downloadingPdf}
                className="rounded-full border border-ink-900/20 px-4 py-2 text-sm font-medium text-ink-900 transition-colors hover:bg-ink-900 hover:text-white disabled:opacity-50"
              >
                {downloadingPdf ? "Готовим…" : "Скачать PDF"}
              </button>
              <button
                onClick={emailPdf}
                disabled={sendingPdf}
                className="rounded-full border border-ink-900/20 px-4 py-2 text-sm font-medium text-ink-900 transition-colors hover:bg-ink-900 hover:text-white disabled:opacity-50"
              >
                {sendingPdf ? "Отправляем…" : "Получить PDF на почту"}
              </button>
            </div>
          </div>
        )}
        {pdfNotice && <p className="mt-3 text-xs font-mono text-violet">{pdfNotice}</p>}
      </div>
    </main>
  );
}
