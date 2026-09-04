"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { PLANS, PricingPlan } from "@/lib/plans";
import DisclaimerModal from "@/components/DisclaimerModal";

export default function PricingSection() {
  const { data: session } = useSession();
  const [notice, setNotice] = useState<{ planId: string; text: string } | null>(null);
  const [pendingPlan, setPendingPlan] = useState<PricingPlan | null>(null);
  const [paying, setPaying] = useState(false);

  const openConfirm = (plan: PricingPlan) => {
    setNotice(null);
    setPendingPlan(plan);
  };

  const confirmPlan = async () => {
    const plan = pendingPlan;
    setPendingPlan(null);
    if (!plan) return;

    if (plan.free) {
      document.querySelector("#wizard")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (!session?.user?.email) {
      setNotice({
        planId: plan.id,
        text: "Сначала зарегистрируйтесь или войдите в анкете ниже — тариф закрепится за вашим аккаунтом.",
      });
      document.querySelector("#wizard")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    setPaying(true);
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
        setPaying(false);
        return;
      }
      window.location.href = data.confirmationUrl;
    } catch {
      setNotice({
        planId: plan.id,
        text: "Не удалось связаться с сервером оплаты — попробуйте ещё раз чуть позже.",
      });
      setPaying(false);
    }
  };

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`flex flex-col rounded-2xl border p-6 ${
              plan.highlighted
                ? "border-brand bg-ink-900 text-white shadow-lg lg:-translate-y-2"
                : "border-line bg-white text-ink-900"
            }`}
          >
            {plan.highlighted && (
              <span className="mb-3 inline-block w-fit rounded-full bg-brand px-3 py-1 text-xs font-mono text-ink-900">
                Популярный выбор
              </span>
            )}
            {plan.free && (
              <span className="mb-3 inline-block w-fit rounded-full bg-violet-soft px-3 py-1 text-xs font-mono text-violet">
                Для знакомства
              </span>
            )}
            <h3 className="font-display text-xl mb-1">{plan.name}</h3>
            <p className={`text-sm mb-4 ${plan.highlighted ? "text-white/70" : "text-muted"}`}>
              {plan.description}
            </p>
            <div className="mb-6">
              <span className="font-display text-3xl">{plan.price}</span>{" "}
              <span className={plan.highlighted ? "text-white/60" : "text-muted"}>
                {plan.period}
              </span>
            </div>
            <ul className="mb-6 flex-1 space-y-2.5">
              {plan.features.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className={plan.highlighted ? "text-brand" : "text-violet"}>✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => openConfirm(plan)}
              disabled={paying}
              className={`w-full rounded-full px-5 py-3 text-sm font-medium transition-colors disabled:opacity-60 ${
                plan.highlighted
                  ? "bg-brand text-ink-900 hover:bg-brand/90"
                  : plan.free
                  ? "border border-ink-900/20 bg-white text-ink-900 hover:bg-ink-900 hover:text-white"
                  : "bg-ink-900 text-white hover:bg-ink-800"
              }`}
            >
              {paying ? "Переходим к оплате…" : plan.free ? "Попробовать бесплатно" : "Оформить подписку"}
            </button>
            {notice?.planId === plan.id && (
              <p className="mt-3 text-xs font-mono text-violet">{notice.text}</p>
            )}
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
    </div>
  );
}
