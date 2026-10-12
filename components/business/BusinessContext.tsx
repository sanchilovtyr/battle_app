"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { getBusiness, updateBusinessVector, Business } from "@/lib/account";
import { getPlan, PlanId, PricingPlan } from "@/lib/plans";
import { computeEffectivePlanId } from "@/lib/subscriptionUtils";
import { ChecklistState, getChecklist, toggleStep } from "@/lib/checklist";
import { FunnelSnapshot, getSnapshots } from "@/lib/funnel";
import { getGrowthTarget } from "@/lib/growthTarget";
import { recordProgress } from "@/lib/progressHistory";
import { useCloudSync } from "@/lib/useCloudSync";
import type { VectorId } from "@/lib/vectors";

export interface BusinessCtx {
  status: "loading" | "authenticated" | "unauthenticated";
  loaded: boolean;
  business: Business | null;
  effectivePlanId: PlanId;
  planMeta: PricingPlan;
  checklist: ChecklistState;
  snapshots: FunnelSnapshot[];
  setSnapshots: (s: FunnelSnapshot[]) => void;
  /** меняется, только если цель на месяц изменили в другом браузере — тогда форма в аналитике обновится */
  targetKey: string;
  toggle: (moduleId: string, stepIndex: number, stepsLength: number) => void;
  /** Сохраняет вектор аудитории. Определяется один раз: повторный вызов ничего не меняет. */
  saveVector: (vectorId: VectorId) => void;
}

const Ctx = createContext<BusinessCtx | null>(null);

export function useBusiness(): BusinessCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBusiness вне BusinessProvider");
  return v;
}

/** Загружает бизнес пользователя и всё, что нужно разделам плана (чек-лист, показатели, тариф),
 *  один раз для всех страниц /business/[id]/*. */
export function BusinessProvider({ id, children }: { id: string; children: React.ReactNode }) {
  const { status } = useSession();
  const { ready: cloudReady, tick: cloudTick } = useCloudSync();
  const [loaded, setLoaded] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [effectivePlanId, setEffectivePlanId] = useState<PlanId>("trial");
  const [checklist, setChecklist] = useState<ChecklistState>({});
  const [snapshots, setSnapshots] = useState<FunnelSnapshot[]>([]);
  const [targetKey, setTargetKey] = useState("");

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setLoaded(true);
      return;
    }
    if (!cloudReady) return; // данные ещё подтягиваются с сервера
    const b = getBusiness(id);
    setBusiness(b);
    if (b) {
      const cl = getChecklist(b.id);
      setChecklist(cl);
      setSnapshots(getSnapshots(b.id));
      setTargetKey(JSON.stringify(getGrowthTarget(b.id)));
      if (b.plan) recordProgress(b.id, b.plan, cl); // точка отсчёта для дашборда
    }
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setEffectivePlanId(computeEffectivePlanId(data?.subscription ?? null)))
      .finally(() => setLoaded(true));
  }, [status, id, cloudReady, cloudTick]);

  const toggle = useCallback(
    (moduleId: string, stepIndex: number, stepsLength: number) => {
      if (!business) return;
      const next = toggleStep(business.id, moduleId, stepIndex, stepsLength);
      setChecklist(next);
      if (business.plan) recordProgress(business.id, business.plan, next); // история для дашборда
    },
    [business]
  );

  const saveVector = useCallback(
    (vectorId: VectorId) => {
      if (!business || business.vectorId) return;
      updateBusinessVector(business.id, vectorId);
      setBusiness({ ...business, vectorId });
    },
    [business]
  );

  const value = useMemo<BusinessCtx>(
    () => ({
      status,
      loaded,
      business,
      effectivePlanId,
      planMeta: getPlan(effectivePlanId),
      checklist,
      snapshots,
      setSnapshots,
      targetKey,
      toggle,
      saveVector,
    }),
    [status, loaded, business, effectivePlanId, checklist, snapshots, targetKey, toggle, saveVector]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
