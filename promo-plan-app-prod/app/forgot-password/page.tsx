"use client";

import { useState } from "react";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Введите корректный email");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось отправить письмо, попробуйте ещё раз.");
        return;
      }
      setDone(true);
    } catch {
      setError("Не удалось связаться с сервером, попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 py-16 md:px-8 md:py-24">
        {done ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-violet-soft text-violet">
              ✓
            </div>
            <h1 className="font-display text-2xl text-ink-900 mb-2">Проверьте почту</h1>
            <p className="text-muted">
              Если аккаунт с адресом <b className="text-ink-900">{email}</b> существует, мы
              отправили на него ссылку для восстановления пароля. Ссылка действует 1 час.
            </p>
          </div>
        ) : (
          <>
            <h1 className="font-display text-2xl md:text-3xl text-ink-900 mb-1.5">Забыли пароль?</h1>
            <p className="text-muted mb-6">
              Укажите email, с которым регистрировались, — пришлём ссылку для восстановления.
            </p>
            <form onSubmit={submit} className="grid gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.ru"
                className="w-full rounded-xl border border-line bg-white p-4 text-ink-900 outline-none transition-colors focus:border-violet"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-brand px-5 py-4 text-sm font-extrabold text-ink-900 transition hover:-translate-y-0.5 hover:bg-brand/90 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {submitting ? "Отправляем…" : "Прислать ссылку"}
              </button>
            </form>
          </>
        )}
        <p className="mt-6 text-sm text-muted">
          <Link href="/#wizard" className="underline underline-offset-4 hover:text-ink-900">
            ← Вернуться ко входу
          </Link>
        </p>
      </div>
    </main>
  );
}
