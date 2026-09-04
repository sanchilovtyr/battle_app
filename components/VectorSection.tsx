"use client";

import { useState } from "react";
import { VECTOR_QUESTIONS, determineVector, VectorId, VectorProfile } from "@/lib/vectors";

export default function VectorSection() {
  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<VectorId[]>([]);
  const [result, setResult] = useState<VectorProfile | null>(null);

  const question = VECTOR_QUESTIONS[stepIndex];
  const isLast = stepIndex === VECTOR_QUESTIONS.length - 1;

  const selectOption = (value: VectorId) => {
    const next = [...answers, value];
    if (isLast) {
      setResult(determineVector(next));
    } else {
      setAnswers(next);
      setStepIndex((s) => s + 1);
    }
  };

  const restart = () => {
    setStarted(false);
    setStepIndex(0);
    setAnswers([]);
    setResult(null);
  };

  return (
    <div className="print:hidden mt-10 rounded-2xl border border-violet/30 bg-violet-soft p-6 md:p-7">
      {!started && (
        <div>
          <span className="mb-2 inline-block rounded-full bg-white px-3 py-1 text-xs font-bold text-violet">
            Доступно на вашем тарифе
          </span>
          <h3 className="mb-2 font-display text-xl text-ink-900">Вектор аудитории</h3>
          <p className="mb-4 text-sm text-ink-900/70">
            3 коротких вопроса о вашей аудитории — и вы получите её психологический профиль
            (главную боль и главную мечту) и конкретные рекомендации по тону, форматам и
            призывам для рекламы именно под этот тип клиентов.
          </p>
          <button
            onClick={() => setStarted(true)}
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-800"
          >
            Определить вектор аудитории
          </button>
        </div>
      )}

      {started && !result && (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="font-mono text-xs text-ink-900/50">
              {stepIndex + 1} / {VECTOR_QUESTIONS.length}
            </span>
            <div className="h-1 flex-1 rounded-full bg-white">
              <div
                className="h-1 rounded-full bg-violet transition-all"
                style={{ width: `${((stepIndex + 1) / VECTOR_QUESTIONS.length) * 100}%` }}
              />
            </div>
          </div>
          <h3 className="mb-1 font-display text-lg text-ink-900">{question.title}</h3>
          {question.subtitle && <p className="mb-4 text-sm text-ink-900/60">{question.subtitle}</p>}
          {!question.subtitle && <div className="mb-4" />}
          <div className="grid gap-2.5">
            {question.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => selectOption(opt.value)}
                className="rounded-xl border border-white bg-white p-3.5 text-left text-sm font-medium text-ink-900 transition-colors hover:border-violet"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div>
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

          <button
            onClick={restart}
            className="rounded-full border border-ink-900/20 bg-white px-5 py-2.5 text-sm font-medium text-ink-900 transition-colors hover:bg-ink-900 hover:text-white"
          >
            Пройти заново
          </button>
        </div>
      )}
    </div>
  );
}
