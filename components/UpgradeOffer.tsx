"use client";

import { useState } from "react";
import { PLANS, PlanId, PricingPlan } from "@/lib/plans";
import DisclaimerModal from "@/components/DisclaimerModal";

/** Предложение расширить тариф на странице готового плана: показывает все
 *  тарифы выше текущего с полным списком возможностей и ведёт сразу к оплате.
 *  На самом высоком тарифе ничего не рисует. Пользователь здесь всегда уже
 *  вошёл (страница /business/[id] доступна только после регистрации). */
export default function UpgradeOffer({ currentPlanId }: { currentPlanId: PlanId }) {
  const [pendingPlan, setPendingPlan] = useState<PricingPlan | null>(null);
  const [payingId, setPayingId] = useState<PlanId | null>(null);
  const [notice, setNotice] = useState<{ planId: PlanId; text: string } | null>(null);

  const currentIndex = PLANS.findIndex((p) => p.id === currentPlanId);
  const higherPlans = PLANS.filter((p, i) => i > currentIndex && !p.free);
  if (higherPlans.length === 0) return null;

  const current = PLANS[currentIndex];

  const confirmPlan = async () => {
    const plan = pendingPlan;
    setPendingPlan(null);
    if (!plan) return;

    setNotice(null);
    setPayingId(plan.id);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.confirmationUrl) {
        setNotice({
          planId: plan.id,
          text: data.error || "Не удалось создать платёж — попробуйте ещё раз чуть позже.",
        });
        setPayingId(null);
        return;
      }
      window.location.href = data.confirmationUrl;
    } catch {
      setNotice({
        planId: plan.id,
        text: "Не удалось связаться с сервером оплаты — попробуйте ещё раз чуть позже.",
      });
      setPayingId(null);
    }
  };

  const gridCols =
    higherPlans.length >= 3 ? "lg:grid-cols-3" : higherPlans.length === 2 ? "lg:grid-cols-2" : "";

  return (
    <section id="upgrade" className="print:hidden mt-8 scroll-mt-24 rounded-2xl border border-violet/20 bg-violet-soft/40 p-5 md:p-7">
      <p className="text-xs font-mono uppercase tracking-wide text-violet mb-2">
        Сейчас у вас тариф «{current.name}»
      </p>
      <h2 className="font-display text-xl md:text-2xl text-ink-900 mb-1.5">
        Расширьте возможности — доведите план до результата
      </h2>
      <p className="mb-6 max-w-2xl text-sm text-muted">
        План — это только карта. Платные тарифы помогают пройти по ней до конца: этапы открываются
        полностью, появляются чек-листы, аналитика и рекомендации под вашу аудиторию.
      </p>

      <div className={`grid gap-4 ${gridCols}`}>
        {higherPlans.map((plan) => (
          <div
            key={plan.id}
            className={`flex flex-col rounded-2xl border p-5 ${
              plan.highlighted
                ? "border-brand bg-ink-900 text-white shadow-lg"
                : "border-line bg-white text-ink-900"
            }`}
          >
            {plan.highlighted && (
              <span className="mb-3 inline-block w-fit rounded-full bg-brand px-3 py-1 text-xs font-bold text-ink-900">
                Популярный выбор
              </span>
            )}
            <h3 className="font-display text-lg mb-1">{plan.name}</h3>
            <p className={`text-sm mb-3 ${plan.highlighted ? "text-white/70" : "text-muted"}`}>
              {plan.description}
            </p>
            <div className="mb-4">
              <span className="font-display text-2xl">{plan.price}</span>{" "}
              <span className={plan.highlighted ? "text-white/60" : "text-muted"}>{plan.period}</span>
            </div>
            <ul className="mb-5 flex-1 space-y-2">
              {plan.features.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className={plan.highlighted ? "text-brand" : "text-violet"}>✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => {
                setNotice(null);
                setPendingPlan(plan);
              }}
              disabled={payingId !== null}
              className={`w-full rounded-full px-5 py-3 text-sm font-medium transition hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 ${
                plan.highlighted
                  ? "bg-brand text-ink-900 hover:bg-brand/90"
                  : "bg-ink-900 text-white hover:bg-ink-800"
              }`}
            >
              {payingId === plan.id ? "Переходим к оплате…" : `Перейти на «${plan.name}»`}
            </button>
            <p className={`mt-2 text-center text-xs ${plan.highlighted ? "text-white/50" : "text-muted"}`}>
              Отменить можно в любой момент
            </p>
            {notice?.planId === plan.id && <p className="mt-3 text-xs text-violet">{notice.text}</p>}
          </div>
        ))}
      </div>

      {pendingPlan && (
        <DisclaimerModal
          planName={pendingPlan.name}
          onConfirm={confirmPlan}
          onCancel={() => setPendingPlan(null)}
        />
      )}
    </section>
  );
}
