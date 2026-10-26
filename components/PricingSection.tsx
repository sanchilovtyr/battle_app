"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { PLANS, PricingPlan } from "@/lib/plans";
import DisclaimerModal from "@/components/DisclaimerModal";

interface PromoOffer {
  planId: string;
  originalRub: number;
  finalRub: number;
  free: boolean;
  text: string;
}

interface AppliedPromo {
  code: string;
  percent: number;
  offers: PromoOffer[];
}

/** Сколько пунктов тарифа видно сразу; остальные раскрываются по кнопке. */
const VISIBLE_FEATURES = 5;

const fmtRub = (n: number) => `${n.toLocaleString("ru-RU").replace(/\u00a0/g, " ")} ₽`;

export default function PricingSection() {
  const { data: session } = useSession();
  const [notice, setNotice] = useState<{ planId: string; text: string } | null>(null);
  const [pendingPlan, setPendingPlan] = useState<PricingPlan | null>(null);
  const [paying, setPaying] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promo, setPromo] = useState<AppliedPromo | null>(null);

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setPromoError("");
    setPromoBusy(true);
    try {
      const res = await fetch("/api/promo/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setPromo(null);
        setPromoError(
          res.status === 401
            ? "Чтобы применить промокод, сначала зарегистрируйтесь или войдите в анкете ниже."
            : data.error || "Не удалось проверить промокод"
        );
      } else {
        setPromo(data as AppliedPromo);
      }
    } catch {
      setPromoError("Не удалось связаться с сервером. Попробуйте ещё раз чуть позже.");
    } finally {
      setPromoBusy(false);
    }
  };

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
        body: JSON.stringify({ planId: plan.id, ...(promo && promo.offers.some((o) => o.planId === plan.id) ? { promoCode: promo.code } : {}) }),
      });
      const data = await res.json();
      if (res.ok && data.activated) {
        window.location.href = "/account?payment=done";
        return;
      }
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
        {PLANS.map((plan) => {
          const offer = promo?.offers.find((o) => o.planId === plan.id);
          return (
          <div
            key={plan.id}
            className={`flex flex-col rounded-2xl border p-6 transition-all duration-300 ease-out ${
              plan.highlighted
                ? "border-brand bg-ink-900 text-white shadow-lg lg:-translate-y-2 hover:lg:-translate-y-4 hover:shadow-[0_24px_50px_rgba(17,21,37,0.35)]"
                : "border-line bg-white text-ink-900 hover:-translate-y-2 hover:border-violet hover:shadow-[0_24px_50px_rgba(118,88,246,0.2)]"
            }`}
          >
            {plan.highlighted && (
              <span className="mb-3 inline-block w-fit rounded-full bg-brand px-3 py-1 text-xs font-bold text-ink-900">
                Популярный выбор
              </span>
            )}
            {plan.free && (
              <span className="mb-3 inline-block w-fit rounded-full bg-violet-soft px-3 py-1 text-xs font-bold text-violet">
                Для знакомства
              </span>
            )}
            <h3 className="font-display text-xl mb-1">{plan.name}</h3>
            <p className={`text-sm mb-4 ${plan.highlighted ? "text-white/70" : "text-muted"}`}>
              {plan.description}
            </p>
            <div className="mb-6">
              {offer ? (
                <>
                  <span className="mr-2 text-base line-through opacity-60">{plan.price}</span>
                  <span className="font-display text-3xl">{offer.free ? "0 ₽" : fmtRub(offer.finalRub)}</span>{" "}
                  <span className={plan.highlighted ? "text-white/60" : "text-muted"}>первый месяц</span>
                  <p className={`mt-2 text-xs ${plan.highlighted ? "text-white/70" : "text-muted"}`}>{offer.text}</p>
                </>
              ) : (
                <>
                  <span className="font-display text-3xl">{plan.price}</span>{" "}
                  <span className={plan.highlighted ? "text-white/60" : "text-muted"}>
                    {plan.period}
                  </span>
                </>
              )}
            </div>
            <div className="mb-6 flex-1">
              <ul id={`features-${plan.id}`} className="space-y-2.5">
                {(expanded[plan.id] ? plan.features : plan.features.slice(0, VISIBLE_FEATURES)).map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className={plan.highlighted ? "text-brand" : "text-violet"}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {plan.features.length > VISIBLE_FEATURES && (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [plan.id]: !e[plan.id] }))}
                  aria-expanded={!!expanded[plan.id]}
                  aria-controls={`features-${plan.id}`}
                  className={`mt-3 text-sm font-medium underline underline-offset-4 ${plan.highlighted ? "text-brand hover:text-white" : "text-violet hover:text-ink-900"}`}
                >
                  {expanded[plan.id] ? "Свернуть" : `Показать все возможности (ещё ${plan.features.length - VISIBLE_FEATURES})`}
                </button>
              )}
            </div>
            <button
              onClick={() => openConfirm(plan)}
              disabled={paying}
              className={`w-full rounded-full px-5 py-3 text-sm font-medium transition hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 ${
                plan.highlighted
                  ? "bg-brand text-ink-900 hover:bg-brand/90"
                  : plan.free
                  ? "border border-ink-900/20 bg-white text-ink-900 hover:bg-ink-900 hover:text-white"
                  : "bg-ink-900 text-white hover:bg-ink-800"
              }`}
            >
              {paying ? "Переходим к оплате…" : plan.free ? "Попробовать бесплатно" : "Оформить подписку"}
            </button>
            {!plan.free && (
              <p className={`mt-2.5 text-center text-xs ${plan.highlighted ? "text-white/50" : "text-muted"}`}>
                Отменить можно в любой момент
              </p>
            )}
            {notice?.planId === plan.id && (
              <p className="mt-3 text-xs text-violet">{notice.text}</p>
            )}
          </div>
        );
        })}
      </div>

      <div className="mt-6 text-center">
        {!promoOpen && !promo ? (
          <button onClick={() => setPromoOpen(true)} className="text-sm text-violet underline underline-offset-4 hover:text-ink-900">
            Есть промокод?
          </button>
        ) : (
          <div className="mx-auto max-w-md">
            <div className="flex gap-2">
              <input
                value={promoInput}
                onChange={(e) => {
                  setPromoInput(e.target.value);
                  if (promo) setPromo(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                maxLength={40}
                placeholder="Промокод"
                aria-label="Промокод"
                className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm text-ink-900 focus:border-ink-900 focus:outline-none"
              />
              <button
                onClick={applyPromo}
                disabled={promoBusy || !promoInput.trim()}
                className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-40"
              >
                {promoBusy ? "Проверяем…" : "Применить"}
              </button>
            </div>
            {promoError && (
              <p className="mt-2 text-sm text-red-700" role="alert">
                {promoError}
              </p>
            )}
            {promo && (
              <p className="mt-2 text-sm text-emerald-700" role="status">
                {promo.offers.length === 1 ? `Промокод применён к тарифу «${PLANS.find((p) => p.id === promo.offers[0].planId)?.name}».` : "Промокод применён: скидка показана в карточках платных тарифов."} Нажмите «Оформить подписку» в нужной карточке.
              </p>
            )}
          </div>
        )}
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
