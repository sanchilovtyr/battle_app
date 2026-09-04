"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DISCLAIMER_PARAGRAPHS } from "@/lib/disclaimer";

export default function DisclaimerModal({
  planName,
  onConfirm,
  onCancel,
}: {
  planName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Согласие с условиями сервиса"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl"
      >
        <div className="border-b border-line p-5 md:p-6">
          <h2 className="font-display text-lg text-ink-900 md:text-xl">Прежде чем продолжить</h2>
          <p className="mt-1 text-sm text-muted">
            Тариф «{planName}» — коротко о том, как устроены наши рекомендации.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 md:p-6">
          <div className="space-y-3 text-sm leading-relaxed text-ink-900/80">
            {DISCLAIMER_PARAGRAPHS.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        <div className="border-t border-line p-5 md:p-6">
          <label className="mb-4 flex cursor-pointer items-start gap-3 text-sm text-ink-900">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-violet"
            />
            <span>
              Я ознакомлен(а) с этим текстом и согласен(на) с условиями{" "}
              <Link href="/oferta" target="_blank" className="underline underline-offset-4 hover:text-violet">
                договора оферты
              </Link>{" "}
              и{" "}
              <Link href="/privacy" target="_blank" className="underline underline-offset-4 hover:text-violet">
                политики обработки персональных данных
              </Link>
            </span>
          </label>
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              onClick={onCancel}
              className="rounded-full border border-ink-900/20 px-5 py-2.5 text-sm font-medium text-ink-900 transition-colors hover:bg-soft"
            >
              Отмена
            </button>
            <button
              onClick={onConfirm}
              disabled={!agreed}
              className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-ink-900"
            >
              Оформить подписку
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
