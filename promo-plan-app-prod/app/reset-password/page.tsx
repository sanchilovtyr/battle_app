"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import SiteHeader from "@/components/SiteHeader";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="font-display text-2xl text-ink-900 mb-2">Ссылка недействительна</h1>
        <p className="text-muted mb-6">Похоже, вы перешли по неполной или устаревшей ссылке.</p>
        <Link
          href="/forgot-password"
          className="inline-block rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-800"
        >
          Запросить новую ссылку
        </Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError("Пароль должен быть не короче 6 символов");
      return;
    }
    if (password !== confirm) {
      setError("Пароли не совпадают");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось изменить пароль, попробуйте ещё раз.");
        return;
      }
      setDone(true);
      // Сразу входим новым паролем, чтобы не заставлять вводить его второй раз
      if (data.email) {
        setSigningIn(true);
        await signIn("credentials", { redirect: false, email: data.email, password });
        setSigningIn(false);
      }
    } catch {
      setError("Не удалось связаться с сервером, попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-violet-soft text-violet">
          ✓
        </div>
        <h1 className="font-display text-2xl text-ink-900 mb-2">Пароль изменён</h1>
        <p className="text-muted mb-6">
          {signingIn ? "Входим в аккаунт…" : "Можно пользоваться сервисом с новым паролем."}
        </p>
        <Link
          href="/account"
          className="inline-block rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-ink-800"
        >
          Перейти в личный кабинет →
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl md:text-3xl text-ink-900 mb-1.5">Новый пароль</h1>
      <p className="text-muted mb-6">Придумайте пароль не короче 6 символов.</p>
      <form onSubmit={submit} className="grid gap-3">
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Новый пароль"
          className="w-full rounded-xl border border-line bg-white p-4 text-ink-900 outline-none transition-colors focus:border-violet"
        />
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Повторите пароль"
          className="w-full rounded-xl border border-line bg-white p-4 text-ink-900 outline-none transition-colors focus:border-violet"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-brand px-5 py-4 text-sm font-extrabold text-ink-900 transition hover:-translate-y-0.5 hover:bg-brand/90 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {submitting ? "Сохраняем…" : "Сохранить новый пароль"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-md px-5 py-16 md:px-8 md:py-24">
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
