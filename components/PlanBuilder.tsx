"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import VectorSection from "@/components/VectorSection";
import { QUESTIONS } from "@/lib/questions";
import { generatePlan } from "@/lib/ruleEngine";
import { Answers, GeneratedPlan, PlanEntry, Phase } from "@/lib/types";
import { getPlan, PlanId } from "@/lib/plans";
import { computeEffectivePlanId } from "@/lib/subscriptionUtils";
import { getBusinesses, addBusiness, clearAccount, Business } from "@/lib/account";

type RawAnswers = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHASE_META: Record<Phase, { title: string; note: string }> = {
  foundation: {
    title: "Этап 1. Фундамент",
    note: "Без этого платный трафик и продвижение будут работать вхолостую",
  },
  traffic: {
    title: "Этап 2. Привлечение трафика",
    note: "Каналы, подобранные под вашу нишу, бюджет и цель",
  },
  retention: {
    title: "Этап 3. Удержание и повторные продажи",
    note: "Дешевле удержать клиента, чем привлечь нового",
  },
};

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  retail: "Розничная торговля",
  services: "Услуги",
  horeca: "Кафе, ресторан",
  b2b: "B2B",
  online_edu: "Онлайн-школа",
  ecommerce: "Интернет-магазин",
  other: "Другое",
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

function PlanColumn({ phase, entries }: { phase: Phase; entries: PlanEntry[] }) {
  const meta = PHASE_META[phase];
  if (entries.length === 0) return null;
  return (
    <div className="mb-10">
      <div className="flex items-baseline justify-between border-b border-line pb-2 mb-4">
        <h3 className="font-display text-lg md:text-xl text-ink-900">{meta.title}</h3>
        <span className="hidden md:block text-sm text-muted">{meta.note}</span>
      </div>
      <p className="md:hidden text-sm text-muted mb-4">{meta.note}</p>
      <div className="space-y-4">
        {entries.map((entry, i) => (
          <details
            key={entry.module.id}
            className="group rounded-xl border border-line bg-white open:bg-white transition-colors"
            open={i === 0}
          >
            <summary className="flex cursor-pointer items-start gap-4 list-none p-4 md:p-5">
              <span className="waypoint-num shrink-0 mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-violet text-paper">
                {i + 1}
              </span>
              <span className="flex-1">
                <span className="block font-display text-base md:text-lg text-ink-900">
                  {entry.module.title}
                </span>
                <span className="block text-sm text-muted mt-1">{entry.module.timeToResult}</span>
              </span>
              <span className="mt-1 text-ink-900/30 transition-transform group-open:rotate-180">⌄</span>
            </summary>
            <div className="px-4 md:px-5 pb-5 pl-[3.25rem] md:pl-[3.75rem]">
              <p className="text-sm md:text-base text-ink-900/80 mb-3">{entry.reason}</p>
              <ul className="space-y-2">
                {entry.module.steps.map((step, si) => (
                  <li key={si} className="flex gap-2 text-sm md:text-base text-ink-900/90">
                    <span className="text-brand font-mono">→</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function LockedVectorCard() {
  return (
    <div className="print:hidden mt-10 rounded-2xl border border-dashed border-ink-900/20 bg-soft p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-brand">
        🔒
      </div>
      <h3 className="font-display text-lg text-ink-900 mb-1.5">Вектор аудитории</h3>
      <p className="mx-auto mb-4 max-w-md text-sm text-muted">
        На тарифах «Бизнес» и «Команда» доступен мини-квиз, который определяет психологический
        профиль вашей аудитории и даёт рекомендации по тону и формату рекламы под него.
      </p>
      <a
        href="#pricing"
        className="inline-block rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-800"
      >
        Посмотреть тарифы
      </a>
    </div>
  );
}

function LockedPhaseCard() {
  const meta = PHASE_META.retention;
  return (
    <div className="print:hidden mb-10 rounded-xl border border-dashed border-ink-900/20 bg-soft p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-brand">
        🔒
      </div>
      <h3 className="font-display text-lg text-ink-900 mb-1.5">{meta.title}</h3>
      <p className="mx-auto mb-4 max-w-md text-sm text-muted">
        На пробном тарифе этот этап скрыт. Оформите платную подписку, чтобы открыть удержание
        клиентов и повторные продажи — вместе с чек-листами и обновлениями плана.
      </p>
      <a
        href="#pricing"
        className="inline-block rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-800"
      >
        Открыть все этапы
      </a>
    </div>
  );
}

function AuthGate({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Введите корректный email");
      return;
    }
    if (password.length < 6) {
      setError("Пароль должен быть не короче 6 символов");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Не удалось зарегистрироваться");
          setSubmitting(false);
          return;
        }
      }

      const result = await signIn("credentials", {
        redirect: false,
        email: email.trim(),
        password,
      });

      if (result?.error) {
        setError(
          mode === "login" ? "Неверный email или пароль" : "Аккаунт создан, но не удалось войти — попробуйте войти вручную"
        );
        setSubmitting(false);
        return;
      }

      onDone();
    } catch {
      setError("Что-то пошло не так, попробуйте ещё раз");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <span className="inline-block rounded-full bg-violet-soft px-3 py-1 text-xs font-bold text-violet">
        Шаг 0 · 30 секунд
      </span>
      <h2 className="font-display text-2xl md:text-3xl text-ink-900 mt-4 mb-1.5">
        {mode === "register" ? "Для начала — регистрация" : "С возвращением"}
      </h2>
      <p className="text-muted mb-5">
        Понадобится для личного кабинета: там же можно управлять подпиской и скачивать планы.
      </p>

      <div className="mb-5 flex gap-2 rounded-full bg-soft p-1">
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
            mode === "register" ? "bg-white text-ink-900 shadow-sm" : "text-muted"
          }`}
        >
          Регистрация
        </button>
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-full py-2 text-sm font-medium transition-colors ${
            mode === "login" ? "bg-white text-ink-900 shadow-sm" : "text-muted"
          }`}
        >
          Вход
        </button>
      </div>

      <form onSubmit={submit} className="grid gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.ru"
          className="w-full rounded-xl border border-line bg-white p-4 text-ink-900 outline-none transition-colors focus:border-violet"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль, минимум 6 символов"
          className="w-full rounded-xl border border-line bg-white p-4 text-ink-900 outline-none transition-colors focus:border-violet"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-ink-900 px-5 py-4 text-sm font-medium text-white transition-colors hover:bg-ink-800 disabled:opacity-50"
        >
          {submitting
            ? "Подождите…"
            : mode === "register"
            ? "Зарегистрироваться и продолжить"
            : "Войти"}
        </button>
        {mode === "register" && (
          <p className="text-xs text-muted">
            Регистрируясь, вы соглашаетесь с{" "}
            <Link href="/oferta" target="_blank" className="underline underline-offset-4">
              договором оферты
            </Link>{" "}
            и{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-4">
              политикой обработки персональных данных
            </Link>
            .
          </p>
        )}
      </form>
    </div>
  );
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
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? null;

  const [subLoaded, setSubLoaded] = useState(false);
  const [effectivePlanId, setEffectivePlanId] = useState<PlanId>("trial");
  const [businesses, setBusinesses] = useState<Business[]>([]);

  const [businessName, setBusinessName] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [raw, setRaw] = useState<RawAnswers>({});
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);

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

  const selectOption = (value: string) => {
    const next = { ...raw, [question.id]: value };
    setRaw(next);
    if (isLast) {
      const generated = generatePlan(toAnswers(next));
      setPlan(generated);
      const saved = addBusiness({
        name: businessName || "Мой бизнес",
        businessType: BUSINESS_TYPE_LABELS[next.businessType] ?? next.businessType,
      });
      setBusinesses((prev) => [...prev, saved]);
    } else {
      setStepIndex((s) => s + 1);
    }
  };

  const goBack = () => {
    if (stepIndex > 0) setStepIndex((s) => s - 1);
  };

  const startNewBusiness = () => {
    setRaw({});
    setStepIndex(0);
    setPlan(null);
    setBusinessName(null);
    setPdfNotice(null);
  };

  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const downloadPdf = async () => {
    if (!plan || !businessName) return;
    setPdfNotice(null);
    setDownloadingPdf(true);
    try {
      const res = await fetch("/api/plan/download-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, plan }),
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

  const [sendingPdf, setSendingPdf] = useState(false);

  const emailPdf = async () => {
    if (!plan || !businessName) return;
    setSendingPdf(true);
    setPdfNotice(null);
    try {
      const res = await fetch("/api/plan/email-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPdfNotice(data.error || "Не удалось отправить PDF на почту, попробуйте ещё раз.");
      } else {
        setPdfNotice(`PDF отправлен на ${email}.`);
      }
    } catch {
      setPdfNotice("Не удалось связаться с сервером, попробуйте ещё раз.");
    } finally {
      setSendingPdf(false);
    }
  };

  const answeredValue = raw[question?.id];

  if (status === "loading" || !subLoaded) {
    return <div id="wizard" className="scroll-mt-24" />;
  }

  return (
    <div id="wizard" className="scroll-mt-24">
      {!email && <AuthGate onDone={() => {}} />}

      {email && !plan && businessName === null && limitReached && (
        <LimitReached planId={effectivePlanId} limit={planMeta.businessLimit} />
      )}

      {email && !plan && businessName === null && !limitReached && (
        <BusinessNameGate onSubmit={setBusinessName} />
      )}

      {email && !plan && businessName !== null && (
        <div className="mx-auto max-w-xl">
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

          <div className="mb-6 flex items-center gap-3">
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

          <h2 className="font-display text-2xl md:text-3xl text-ink-900 mb-1">{question.title}</h2>
          {question.subtitle && <p className="text-muted mb-6">{question.subtitle}</p>}
          {!question.subtitle && <div className="mb-6" />}

          <div className="grid gap-3">
            {question.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => selectOption(opt.value)}
                className={`text-left rounded-xl border p-4 transition-colors hover:border-violet hover:bg-violet/5 ${
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

          {stepIndex > 0 && (
            <button
              onClick={goBack}
              className="mt-6 text-sm text-muted hover:text-ink-900 underline underline-offset-4"
            >
              ← Назад
            </button>
          )}
        </div>
      )}

      {email && plan && (
        <div>
          <div id="print-plan">
            <div className="mb-8 rounded-xl border border-violet/30 bg-violet/5 p-5 md:p-6">
              <p className="text-xs font-mono uppercase tracking-wide text-violet mb-2">
                {businessName}
              </p>
              <p className="font-display text-lg md:text-xl text-ink-900">{plan.summary}</p>
            </div>

            <PlanColumn phase="foundation" entries={plan.foundation} />
            <PlanColumn phase="traffic" entries={plan.traffic} />
            {planMeta.fullPlanAccess && <PlanColumn phase="retention" entries={plan.retention} />}
          </div>

          {!planMeta.fullPlanAccess && <LockedPhaseCard />}

          {planMeta.audienceVectorAccess ? (
            <VectorSection />
          ) : (
            <LockedVectorCard />
          )}

          <div className="print:hidden flex flex-col gap-3 rounded-xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">
              {planMeta.fullPlanAccess
                ? `Тариф «${planMeta.name}» открывает все этапы плана — скачайте PDF или получите его на почту.`
                : "Пробный план показывает первые 2 этапа из 3. Подписка открывает все этапы, чек-листы и обновления."}
            </p>
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
              <button
                onClick={startNewBusiness}
                className="rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-ink-800"
              >
                Новый бизнес
              </button>
            </div>
          </div>
          {pdfNotice && (
            <p className="print:hidden mt-3 text-xs font-mono text-violet">{pdfNotice}</p>
          )}
        </div>
      )}
    </div>
  );
}
