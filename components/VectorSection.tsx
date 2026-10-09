"use client";

import { useEffect, useState } from "react";
import { VECTOR_QUESTIONS, determineVector, getVector, VectorId, VectorProfile } from "@/lib/vectors";
import { applyVectorOverride, VectorOverrideData } from "@/lib/adminVectors";

// Вектор аудитории определяется на странице бизнеса (/business/[id]) и только
// на тарифах с audienceVectorAccess; в первую анкету он не входит. Результат
// хранится вместе с бизнесом. Этот файл разделён на три части:
//  - VectorQuiz — сам мини-квиз (показывается только на тарифах с доступом);
//  - VectorResultCard — полная расшифровка результата;
//  - VectorLockedTeaser — приглашение для остальных тарифов: что даёт вектор
//    и где он открывается.

interface VectorQuizProps {
  onComplete: (vectorId: VectorId) => void;
}

export function VectorQuiz({ onComplete }: VectorQuizProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<VectorId[]>([]);

  const question = VECTOR_QUESTIONS[stepIndex];
  const isLast = stepIndex === VECTOR_QUESTIONS.length - 1;

  const selectOption = (value: VectorId) => {
    const next = [...answers, value];
    if (isLast) {
      onComplete(determineVector(next).id);
    } else {
      setAnswers(next);
      setStepIndex((s) => s + 1);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <span className="inline-block rounded-full bg-violet-soft px-3 py-1 text-xs font-bold text-violet">
        Перед вопросами о бизнесе
      </span>
      <h2 className="font-display text-2xl md:text-3xl text-ink-900 mt-4 mb-1.5">
        Сначала — пара слов о ваших клиентах
      </h2>
      <p className="text-muted mb-6">
        3 коротких вопроса о вашей аудитории — чтобы план и рекомендации по рекламе были точнее.
      </p>

      <div className="mb-4 flex items-center gap-3">
        <span className="font-mono text-xs text-muted">
          {stepIndex + 1} / {VECTOR_QUESTIONS.length}
        </span>
        <div className="h-1 flex-1 rounded-full bg-line">
          <div
            className="h-1 rounded-full bg-violet transition-all"
            style={{ width: `${((stepIndex + 1) / VECTOR_QUESTIONS.length) * 100}%` }}
          />
        </div>
      </div>
      <h3 className="mb-1 font-display text-lg text-ink-900">{question.title}</h3>
      {question.subtitle && <p className="mb-4 text-sm text-muted">{question.subtitle}</p>}
      {!question.subtitle && <div className="mb-4" />}
      <div className="grid gap-2.5">
        {question.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => selectOption(opt.value)}
            className="rounded-xl border border-line bg-white p-3.5 text-left text-sm font-medium text-ink-900 transition-colors hover:border-violet hover:bg-violet/5"
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface VectorResultCardProps {
  vectorId: VectorId;
  onRetake?: () => void;
}

export function VectorResultCard({ vectorId, onRetake }: VectorResultCardProps) {
  const [result, setResult] = useState<VectorProfile>(() => getVector(vectorId));

  useEffect(() => {
    setResult(getVector(vectorId));
    fetch("/api/vectors/overrides")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const overrides = (data?.overrides ?? {}) as Record<string, VectorOverrideData>;
        setResult(applyVectorOverride(getVector(vectorId), overrides));
      })
      .catch(() => {});
  }, [vectorId]);

  return (
    <div className="print:hidden mt-10 rounded-2xl border border-violet/30 bg-violet-soft p-6 md:p-7">
      <span className="mb-2 inline-block rounded-full bg-white px-3 py-1 text-xs font-bold text-violet">
        Ваш вектор аудитории
      </span>
      <h3 className="mb-1 font-display text-2xl text-ink-900">{result.name}</h3>
      <p className="mb-5 text-sm italic text-ink-900/60">{result.tagline}</p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-900/50">
            Боль
          </p>
          <p className="text-sm text-ink-900">{result.pain}</p>
        </div>
        <div className="rounded-xl bg-white p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-900/50">
            Мечта
          </p>
          <p className="text-sm text-ink-900">{result.dream}</p>
        </div>
      </div>

      <div className="mb-4 rounded-xl bg-white p-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-900/50">
          Тон коммуникации
        </p>
        <p className="text-sm text-ink-900">{result.toneAdvice}</p>
      </div>

      <div className="mb-4 rounded-xl bg-white p-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-900/50">
          Рекомендации по рекламе
        </p>
        <ul className="space-y-1.5">
          {result.adTips.map((tip, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink-900">
              <span className="text-violet">→</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-5 rounded-xl bg-white p-4">
        <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-900/50">
          Чего избегать
        </p>
        <p className="text-sm text-ink-900">{result.avoid}</p>
      </div>

      {onRetake && (
        <button
          onClick={onRetake}
          className="rounded-full border border-ink-900/20 bg-white px-5 py-2.5 text-sm font-medium text-ink-900 transition-colors hover:bg-ink-900 hover:text-white"
        >
          Пройти заново
        </button>
      )}
    </div>
  );
}

export function VectorLockedTeaser() {
  return (
    <div className="print:hidden mt-10 rounded-2xl border border-dashed border-ink-900/20 bg-soft p-6 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-brand">
        🔒
      </div>
      <h3 className="font-display text-lg text-ink-900 mb-1.5">Вектор аудитории</h3>
      <p className="mx-auto mb-4 max-w-md text-sm text-muted">
        Короткий квиз определяет психологический профиль вашей аудитории: главную боль, мечту,
        тон коммуникации и даёт рекомендации по рекламе. Доступно на тарифах «Бизнес» и «Премиум».
      </p>
      <a
        href="#upgrade"
        className="inline-block rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-800"
      >
        Посмотреть тарифы
      </a>
    </div>
  );
}
