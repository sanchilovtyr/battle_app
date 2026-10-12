"use client";

import { useState } from "react";
import PlanColumn from "@/components/PlanColumn";
import ReadinessScore from "@/components/ReadinessScore";
import ActivityStatusBadge from "@/components/ActivityStatusBadge";
import PhaseBadges from "@/components/PhaseBadges";
import LockedPhaseCard from "@/components/LockedPhaseCard";
import NicheCaseCallout from "@/components/NicheCaseCallout";
import { useBusiness } from "@/components/business/BusinessContext";
import { businessTypeKeyFromLabel } from "@/lib/businessTypes";
import { findCaseForBusinessType } from "@/lib/cases";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

/** Обзор плана: этапы с шагами, индекс готовности, похожий кейс и скачивание плана.
 *  Остальное (вектор, дашборд, потери, точки роста) — на отдельных страницах из левого меню. */
export default function BusinessOverviewPage() {
  const { business, planMeta, checklist, snapshots, toggle } = useBusiness();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingPdf, setSendingPdf] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

  if (!business || !business.plan) return null;
  const plan = business.plan;

  const downloadPdf = async () => {
    setPdfNotice(null);
    setDownloadingPdf(true);
    try {
      const res = await fetch("/api/plan/download-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: business.name, plan }),
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
    setSendingPdf(true);
    setPdfNotice(null);
    try {
      const res = await fetch("/api/plan/email-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName: business.name, plan }),
      });
      const data = await res.json().catch(() => ({}));
      setPdfNotice(res.ok ? "PDF отправлен на почту." : data.error || "Не удалось отправить PDF.");
    } catch {
      setPdfNotice("Не удалось связаться с сервером, попробуйте ещё раз.");
    } finally {
      setSendingPdf(false);
    }
  };

  const nicheCase = findCaseForBusinessType(businessTypeKeyFromLabel(business.businessType));
  const cl = planMeta.checklistAccess ? checklist : undefined;
  const onToggle = planMeta.checklistAccess ? toggle : undefined;

  return (
    <div>
      <div className="mb-8 rounded-xl border border-violet/30 bg-violet/5 p-5 md:p-6">
        <p className="mb-2 text-xs font-mono uppercase tracking-wide text-violet">
          {business.name} · план от {formatDate(business.createdAt)}
        </p>
        <p className="font-display text-lg text-ink-900 md:text-xl">{plan.summary}</p>
      </div>

      <PlanColumn phase="foundation" entries={plan.foundation} checklist={cl} onToggleStep={onToggle} />
      <PlanColumn phase="traffic" entries={plan.traffic} checklist={cl} onToggleStep={onToggle} />
      {planMeta.fullPlanAccess ? (
        <PlanColumn phase="retention" entries={plan.retention} checklist={cl} onToggleStep={onToggle} />
      ) : (
        <LockedPhaseCard />
      )}

      {planMeta.checklistAccess && (
        <div className="print:hidden mt-8 flex flex-wrap items-center justify-between gap-3">
          <PhaseBadges businessId={business.id} plan={plan} checklist={checklist} />
          <ActivityStatusBadge snapshots={snapshots} />
        </div>
      )}
      <div className="print:hidden mt-4">
        <ReadinessScore
          businessId={business.id}
          plan={plan}
          checklist={checklist}
          checklistAccess={planMeta.checklistAccess}
          vectorId={business.vectorId}
          vectorAccess={planMeta.audienceVectorAccess}
          snapshots={snapshots}
        />
      </div>

      {nicheCase && (
        <div className="print:hidden mt-8">
          <NicheCaseCallout c={nicheCase} />
        </div>
      )}

      {planMeta.pdfExportAccess && (
        <div className="mt-8 flex flex-col gap-3 rounded-xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
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
  );
}
