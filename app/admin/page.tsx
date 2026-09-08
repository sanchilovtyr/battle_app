"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminUsersTab from "@/components/AdminUsersTab";
import AdminModulesTab from "@/components/AdminModulesTab";
import AdminRevenueTab from "@/components/AdminRevenueTab";
import AdminMessagesTab from "@/components/AdminMessagesTab";

type Tab = "users" | "modules" | "revenue" | "messages";

const TABS: { id: Tab; label: string }[] = [
  { id: "users", label: "Пользователи" },
  { id: "messages", label: "Сообщения" },
  { id: "modules", label: "Модули плана" },
  { id: "revenue", label: "Выручка" },
];

export default function AdminPage() {
  const [checked, setChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("users");
  const [messagePrefill, setMessagePrefill] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/check")
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then((data) => setUnlocked(Boolean(data.authenticated)))
      .finally(() => setChecked(true));
  }, []);

  const openMessageComposer = (email: string) => {
    setMessagePrefill(email);
    setTab("messages");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Неверный пароль");
        setSubmitting(false);
        return;
      }
      setUnlocked(true);
    } catch {
      setError("Не удалось связаться с сервером");
      setSubmitting(false);
    }
  };

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setUnlocked(false);
    setPassword("");
  };

  if (!checked) {
    return <main className="min-h-screen bg-ink-900" />;
  }

  if (!unlocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-900 px-5">
        <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6">
          <h1 className="mb-1.5 font-display text-xl text-ink-900">Админ-панель</h1>
          <p className="mb-5 text-sm text-muted">Доступ только для владельца сервиса.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            autoFocus
            className="w-full rounded-xl border border-line p-3.5 text-sm outline-none focus:border-violet"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="mt-4 w-full rounded-full bg-ink-900 px-5 py-3 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {submitting ? "Проверяем…" : "Войти"}
          </button>
          <Link href="/" className="mt-4 block text-center text-xs text-muted underline underline-offset-4">
            На главную
          </Link>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-soft">
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-5 py-5 md:px-8">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="font-display text-xl text-ink-900">Админ-панель</h1>
            <div className="flex items-center gap-4">
              <button
                onClick={logout}
                className="text-sm text-muted underline underline-offset-4 hover:text-ink-900"
              >
                Выйти
              </button>
              <Link href="/" className="text-sm text-muted underline underline-offset-4 hover:text-ink-900">
                На сайт
              </Link>
            </div>
          </div>
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  tab === t.id ? "bg-ink-900 text-white" : "border border-line text-ink-900 hover:bg-soft"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        {tab === "users" && <AdminUsersTab onMessage={openMessageComposer} />}
        {tab === "messages" && <AdminMessagesTab prefillEmail={messagePrefill} />}
        {tab === "modules" && <AdminModulesTab />}
        {tab === "revenue" && <AdminRevenueTab />}
      </div>
    </main>
  );
}
