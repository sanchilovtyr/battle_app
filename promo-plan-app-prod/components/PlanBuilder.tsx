"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import AuthGate from "@/components/AuthGate";
import { VectorQuiz, VectorLockedTeaser } from "@/components/VectorSection";
import { VectorId } from "@/lib/vectors";
import PlanColumn from "@/components/PlanColumn";
import { QUESTIONS } from "@/lib/questions";
import { Answers, GeneratedPlan } from "@/lib/types";
import { getPlan, PlanId } from "@/lib/plans";
import { computeEffectivePlanId } from "@/lib/subscriptionUtils";
import { getBusinesses, addBusiness, clearAccount, Business } from "@/lib/account";
import { savePendingGuestPlan, loadPendingGuestPlan, clearPendingGuestPlan } from "@/lib/guestPlan";
import { BUSINESS_TYPE_LABELS } from "@/lib/businessTypes";
import { findCaseForBusinessType } from "@/lib/cases";
import NicheCaseCallout from "@/components/NicheCaseCallout";
import GuestReadinessTeaser from "@/components/GuestReadinessTeaser";

type RawAnswers = Record<string, string>;

// Короткие ярлыки блоков плана, которые собираются по мере ответов — вместо
// абстрактного "3 из 7" показываем, какие конкретные части плана уже учтены.
// Честно: план правда собирается из этих ответов, ничего не выдумываем.
const WIZARD_BLOCK_LABELS: Record<string, string> = {
  businessType: "Ниша",
  hasSite: "Сайт",
  hasSocial: "Соцсети",
  goal: "Цель",
  budget: "Бюджет",
  geo: "География",
  experience: "Опыт",
};

// Что именно определит текущий вопрос — показываем перед ответом, чтобы
// решение об ответе ощущалось не как формальность, а как реальный вклад в
// итоговый план.
const WIZARD_BLOCK_HINTS: Record<string, string> = {
  businessType: "Подберём кейсы и форматы под вашу нишу",
  hasSite: "Учтём в разделе «Фундамент» — нужен ли лендинг",
  hasSocial: "Повлияет на каналы в разделе «Трафик»",
  goal: "Определит акцент всего плана",
  budget: "Подберём каналы, которые впишутся в бюджет",
  geo: "Учтём в выборе гео-таргетинга и площадок",
  experience: "Настроим глубину шагов под ваш опыт",
};

function toAnswers(raw: RawAnswers): Answers {
  return {
    businessType: raw.businessType as Answers["businessType"],
    hasSite: raw.hasSite === "true",
    hasSocial: raw.hasSocial === "true",
    goal: raw.goal as Answers["goal"],
    budget: raw.budget as Answers["budget"],
    geo: raw.geo as Answers["geo"],
    experience: raw.experience as Answers["experience"],
  };
}

function BusinessNameGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [value, setValue] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    onSubmit(trimmed || "Мой бизнес");
  };

  return (
    <div className="mx-auto max-w-md">
      <span className="inline-block rounded-full bg-violet-soft px-3 py-1 text-xs font-bold text-violet">
        Перед вопросами
      </span>
      <h2 className="font-display text-2xl md:text-3xl text-ink-900 mt-4 mb-1.5">
        Как называется бизнес?
      </h2>
      <p className="text-muted mb-6">
        Так план будет проще найти в личном кабинете, если у вас их несколько.
      </p>
      <form onSubmit={submit} className="grid gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Например, «Кофейня на Ленина»"
          className="w-full rounded-xl border border-line bg-white p-4 text-ink-900 outline-none transition-colors focus:border-violet"
        />
        <button
          type="submit"
          className="rounded-xl bg-ink-900 px-5 py-4 text-sm font-medium text-white transition-colors hover:bg-ink-800"
        >
          Дальше →
        </button>
      </form>
    </div>
  );
}

function LimitReached({ planId, limit }: { planId: PlanId; limit: number }) {
  const plan = getPlan(planId);
  return (
    <div className="mx-auto max-w-md text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-soft text-xl">
        🔒
      </div>
      <h2 className="font-display text-2xl text-ink-900 mb-1.5">Лимит тарифа исчерпан</h2>
      <p className="text-muted mb-6">
        Тариф «{plan.name}» позволяет вести {limit === 1 ? "1 бизнес" : `до ${limit} бизнесов`}.
        Удалите один из существующих в личном кабинете или перейдите на тариф с бо́льшим лимитом.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/account"
          className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-800"
        >
          Личный кабинет
        </Link>
        <a
          href="#pricing"
          className="rounded-full border border-ink-900/20 px-5 py-2.5 text-sm font-medium text-ink-900 transition-colors hover:bg-ink-900 hover:text-white"
        >
          Сравнить тарифы
        </a>
      </div>
    </div>
  );
}

export default function PlanBuilder() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? null;

  const [subLoaded, setSubLoaded] = useState(false);
  const [effectivePlanId, setEffectivePlanId] = useState<PlanId>("trial");
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const [businessName, setBusinessName] = useState<string | null>(null);
  const [vectorId, setVectorId] = useState<VectorId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [raw, setRaw] = useState<RawAnswers>({});
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      if (status === "unauthenticated") setSubLoaded(true);
      return;
    }
    setBusinesses(getBusinesses());
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setEffectivePlanId(computeEffectivePlanId(data?.subscription ?? null));
        setSubLoaded(true);
      })
      .catch(() => setSubLoaded(true));
  }, [status]);

  const logOut = () => {
    clearAccount();
    setBusinesses([]);
    setEffectivePlanId("trial");
    setBusinessName(null);
    setVectorId(null);
    setRaw({});
    setStepIndex(0);
    setPlan(null);
    signOut({ redirect: false });
  };

  const planMeta = getPlan(effectivePlanId);
  const limitReached = businesses.length >= planMeta.businessLimit;

  const question = QUESTIONS[stepIndex];
  const isLast = stepIndex === QUESTIONS.length - 1;
  const progress = Math.round(((stepIndex + (plan ? 1 : 0)) / QUESTIONS.length) * 100);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Сохраняет сгенерированный план в личный кабинет (localStorage) и сразу
  // уводит на его отдельную страницу — /business/[id] уже умеет показывать
  // всё (чек-лист, аналитику, точки роста, PDF), дублировать это прямо в
  // анкете на лендинге больше не нужно. Вызывается сразу после генерации,
  // если пользователь уже вошёл, либо позже — сразу после регистрации
  // (кнопкой или через Яндекс ID), если план сначала показали гостю (см.
  // рендер ниже и восстановление после OAuth-редиректа).
  const persistPlan = (
    planToSave: GeneratedPlan,
    name: string,
    businessTypeLabel: string,
    vectorIdToSave?: VectorId
  ) => {
    const saved = addBusiness({
      name: name || "Мой бизнес",
      businessType: businessTypeLabel,
      plan: planToSave,
      vectorId: vectorIdToSave,
    });
    clearPendingGuestPlan();
    router.push(`/business/${saved.id}`);
  };

  // Вектор аудитории определяется до генерации плана — на этом этапе бизнес
  // ещё не сохранён, поэтому просто держим значение в состоянии.
  const handleVectorComplete = (id: VectorId) => {
    setVectorId(id);
  };

  // Пока бизнес показан гостю (ещё не зарегистрировался), держим его прогресс
  // в localStorage — иначе вход через Яндекс ID (уводит с сайта и возвращает
  // на новую загрузку страницы) или случайное обновление страницы стёрли бы
  // определённый вектор и/или готовый план.
  useEffect(() => {
    if (!email && businessName && (vectorId || plan)) {
      savePendingGuestPlan({
        businessName,
        vectorId: vectorId ?? undefined,
        businessType: raw.businessType ? BUSINESS_TYPE_LABELS[raw.businessType] ?? raw.businessType : undefined,
        plan: plan ?? undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessName, vectorId, plan, email]);

  // Гость обновил страницу, ещё не зарегистрировавшись — восстанавливаем имя
  // бизнеса, определённый вектор и (если уже дошёл) сам план.
  useEffect(() => {
    if (status !== "unauthenticated" || businessName !== null) return;
    const pending = loadPendingGuestPlan();
    if (!pending) return;
    setBusinessName(pending.businessName);
    if (pending.vectorId) setVectorId(pending.vectorId);
    if (pending.plan) setPlan(pending.plan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Если пользователь вошёл (в том числе вернувшись из OAuth Яндекса), а на
  // экране ещё нет плана — проверяем, не остался ли не сохранённый гостевой
  // план, и сразу сохраняем его в аккаунт.
  useEffect(() => {
    if (status !== "authenticated" || plan) return;
    const pending = loadPendingGuestPlan();
    if (!pending || !pending.plan) return;
    setBusinessName(pending.businessName);
    if (pending.vectorId) setVectorId(pending.vectorId);
    setPlan(pending.plan);
    persistPlan(pending.plan, pending.businessName, pending.businessType ?? "", pending.vectorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, plan]);

  const selectOption = async (value: string) => {
    const next = { ...raw, [question.id]: value };
    setRaw(next);
    if (isLast) {
      setGenerating(true);
      setGenerateError(null);
      try {
        const res = await fetch("/api/plan/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: toAnswers(next) }),
        });
        const data = await res.json();
        if (!res.ok) {
          setGenerateError(data.error || "Не удалось сформировать план, попробуйте ещё раз.");
          return;
        }
        setPlan(data.plan);
        // Анкету и план можно проходить без регистрации — гостю план сначала
        // просто показывается (частично), в аккаунт он попадёт только после
        // регистрации, через persistPlan в AuthGate.onDone ниже.
        if (email) {
          persistPlan(
            data.plan as GeneratedPlan,
            businessName || "Мой бизнес",
            BUSINESS_TYPE_LABELS[next.businessType] ?? next.businessType,
            vectorId ?? undefined
          );
        }
      } catch {
        setGenerateError("Не удалось связаться с сервером, попробуйте ещё раз.");
      } finally {
        setGenerating(false);
      }
    } else {
      setStepIndex((s) => s + 1);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((s) => s - 1);
  };

  const answeredValue = raw[question?.id];

  if (status === "loading" || !subLoaded) {
    return <div id="wizard" className="scroll-mt-24" />;
  }

  return (
    <div id="wizard" className="scroll-mt-24">
      {!plan && businessName === null && email && limitReached && (
        <LimitReached planId={effectivePlanId} limit={planMeta.businessLimit} />
      )}

      {!plan && businessName === null && !(email && limitReached) && (
        <BusinessNameGate onSubmit={setBusinessName} />
      )}

      {!plan && businessName !== null && (
        <div className="mx-auto max-w-xl">
          {email ? (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>
                Вы вошли как <b className="text-ink-900">{email}</b>
              </span>
              <div className="flex gap-3">
                <Link href="/account" className="underline underline-offset-4 hover:text-ink-900">
                  Личный кабинет
                </Link>
                <button onClick={logOut} className="underline underline-offset-4 hover:text-ink-900">
                  Выйти
                </button>
              </div>
            </div>
          ) : (
            <p className="mb-4 text-xs text-muted">
              Без регистрации — она понадобится только чтобы сохранить готовый план.
            </p>
          )}

          {vectorId === null ? (
            <VectorQuiz onComplete={handleVectorComplete} />
          ) : (
            <>
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-xs text-muted">
                  {String(stepIndex + 1).padStart(2, "0")} / {String(QUESTIONS.length).padStart(2, "0")}
                </span>
                <div className="h-1 flex-1 rounded-full bg-line">
                  <div
                    className="h-1 rounded-full bg-violet transition-all"
                    style={{ width: `${Math.max(progress, 6)}%` }}
                  />
                </div>
              </div>

              <div className="mb-5 flex flex-wrap gap-1.5">
                {QUESTIONS.map((q, i) => {
                  const answered = raw[q.id] !== undefined;
                  const active = i === stepIndex;
                  return (
                    <span
                      key={q.id}
                      className={
                        "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors " +
                        (answered
                          ? "bg-violet text-white"
                          : active
                          ? "bg-violet-soft text-violet"
                          : "bg-soft text-ink-900/30")
                      }
                    >
                      {answered ? "✓ " : ""}
                      {WIZARD_BLOCK_LABELS[q.id] ?? q.id}
                    </span>
                  );
                })}
              </div>

              <h2 className="font-display text-2xl md:text-3xl text-ink-900 mb-1">{question.title}</h2>
              {question.subtitle && <p className="text-muted mb-2">{question.subtitle}</p>}
              {WIZARD_BLOCK_HINTS[question.id] && (
                <p className="mb-6 text-xs text-violet">→ {WIZARD_BLOCK_HINTS[question.id]}</p>
              )}
              {!question.subtitle && !WIZARD_BLOCK_HINTS[question.id] && <div className="mb-6" />}

              <div className="grid gap-3">
                {question.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => selectOption(opt.value)}
                    disabled={generating}
                    className={`text-left rounded-xl border p-4 transition-colors hover:border-violet hover:bg-violet/5 disabled:cursor-not-allowed disabled:opacity-50 ${
                      answeredValue === opt.value
                        ? "border-violet bg-violet/10"
                        : "border-line bg-white/50"
                    }`}
                  >
                    <span className="block font-medium text-ink-900">{opt.label}</span>
                    {opt.hint && <span className="block text-sm text-muted mt-0.5">{opt.hint}</span>}
                  </button>
                ))}
              </div>

              {generating && (
                <p className="mt-4 text-sm text-violet">Собираем ваш план…</p>
              )}
              {generateError && (
                <p className="mt-4 text-sm text-red-600">{generateError}</p>
              )}

              {stepIndex > 0 && (
                <button
                  onClick={goBack}
                  className="mt-6 text-sm text-muted hover:text-ink-900 underline underline-offset-4"
                >
                  ← Назад
                </button>
              )}
            </>
          )}
        </div>
      )}

      {plan && !email && (
        <div className="print:hidden">
          <div className="mb-8 rounded-xl border border-violet/30 bg-violet/5 p-5 md:p-6">
            <p className="text-xs font-mono uppercase tracking-wide text-violet mb-2">{businessName}</p>
            <p className="font-display text-lg md:text-xl text-ink-900">{plan.summary}</p>
          </div>

          <PlanColumn phase="foundation" entries={plan.foundation} />

          <div className="relative mb-10 overflow-hidden rounded-2xl">
            <div aria-hidden className="pointer-events-none select-none blur-sm">
              <PlanColumn phase="traffic" entries={plan.traffic} />
            </div>
            <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-b from-transparent via-white/75 to-white pb-6 pt-16">
              <p className="max-w-xs text-center text-sm font-medium text-ink-900">
                Дальше — этап «Трафик» и ещё один этап плана ↓
              </p>
            </div>
          </div>

          {vectorId && <VectorLockedTeaser />}

          <GuestReadinessTeaser plan={plan} vectorId={vectorId} />

          {(() => {
            const c = findCaseForBusinessType(raw.businessType);
            return c ? <NicheCaseCallout c={c} /> : null;
          })()}

          <AuthGate
            badge="План готов"
            title="Сохраните план — это займёт 30 секунд"
            subtitle="Зарегистрируйтесь, чтобы открыть план целиком и вернуться к нему в любой момент из личного кабинета."
            onDone={() =>
              persistPlan(
                plan,
                businessName || "Мой бизнес",
                BUSINESS_TYPE_LABELS[raw.businessType] ?? raw.businessType,
                vectorId ?? undefined
              )
            }
          />
        </div>
      )}

      {email && plan && (
        // План уже сохранён в персональный кабинет — persistPlan сразу переключает
        // на /business/[id], этот текст виден на экране только на долю секунды,
        // пока идёт переход.
        <div className="print:hidden py-16 text-center text-sm text-muted">
          Открываем ваш план…
        </div>
      )}
    </div>
  );
}
