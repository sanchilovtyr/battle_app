"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, getProviders } from "next-auth/react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthGateProps {
  onDone: () => void;
  badge?: string;
  title?: string;
  subtitle?: string;
  /** С какой вкладки открывать форму — например, "Войти в ЛК" на /account должен
   *  сразу показывать вход, а не регистрацию. */
  initialMode?: "login" | "register";
  /** Куда вернуть пользователя после входа через Яндекс ID (OAuth-редирект уводит
   *  со страницы) — по умолчанию обратно в анкету, но со страницы /account нужно
   *  вернуть на неё же. */
  yandexCallbackUrl?: string;
}

/** Форма регистрации/входа — общая для анкеты (шаг перед сохранением плана) и
 *  для /account (кнопка "Войти в ЛК" для тех, у кого уже есть аккаунт). */
export default function AuthGate({
  onDone,
  badge = "Шаг 0 · 30 секунд",
  title,
  subtitle = "Понадобится для личного кабинета: там же можно управлять подпиской и скачивать планы.",
  initialMode = "register",
  yandexCallbackUrl = "/#wizard",
}: AuthGateProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedOffer, setAgreedOffer] = useState(false);
  const [agreedPd, setAgreedPd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Кнопку "Войти через Яндекс" показываем, только если провайдер реально
  // настроен на сервере (заданы переменные окружения) — иначе она вела бы в
  // ошибку.
  const [yandexEnabled, setYandexEnabled] = useState(false);
  useEffect(() => {
    getProviders()
      .then((providers) => setYandexEnabled(Boolean(providers?.yandex)))
      .catch(() => {});
  }, []);

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
    if (mode === "register" && (!agreedOffer || !agreedPd)) {
      setError("Нужно отдельно принять оферту и дать согласие на обработку персональных данных");
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
        {badge}
      </span>
      <h2 className="font-display text-2xl md:text-3xl text-ink-900 mt-4 mb-1.5">
        {title ?? (mode === "register" ? "Для начала — регистрация" : "С возвращением")}
      </h2>
      <p className="text-muted mb-5">{subtitle}</p>

      {yandexEnabled && (
        <>
          <button
            type="button"
            onClick={() => signIn("yandex", { callbackUrl: yandexCallbackUrl })}
            className="mb-3 flex w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white p-4 text-sm font-medium text-ink-900 transition-colors hover:bg-soft"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FC3F1D] text-[11px] font-black text-white">
              Я
            </span>
            Войти через Яндекс ID
          </button>
          <div className="mb-4 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            или
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

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
          disabled={submitting || (mode === "register" && (!agreedOffer || !agreedPd))}
          className="rounded-xl bg-brand px-5 py-4 text-sm font-extrabold text-ink-900 transition hover:-translate-y-0.5 hover:bg-brand/90 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {submitting
            ? "Подождите…"
            : mode === "register"
            ? "Зарегистрироваться и продолжить"
            : "Войти"}
        </button>
        {mode === "login" && (
          <Link
            href="/forgot-password"
            className="text-sm text-muted underline underline-offset-4 hover:text-ink-900"
          >
            Забыли пароль?
          </Link>
        )}
        {mode === "register" && (
          <div className="grid gap-2">
            <label className="flex items-start gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={agreedOffer}
                onChange={(e) => setAgreedOffer(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>
                Согласен(на) с условиями{" "}
                <Link href="/oferta" target="_blank" className="underline underline-offset-4">
                  договора оферты
                </Link>
              </span>
            </label>
            <label className="flex items-start gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={agreedPd}
                onChange={(e) => setAgreedPd(e.target.checked)}
                className="mt-0.5 shrink-0"
              />
              <span>
                Даю согласие на обработку персональных данных на условиях{" "}
                <Link href="/privacy" target="_blank" className="underline underline-offset-4">
                  политики обработки персональных данных
                </Link>
              </span>
            </label>
          </div>
        )}
      </form>
    </div>
  );
}
