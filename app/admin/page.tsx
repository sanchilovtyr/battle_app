"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminUsersTab from "@/components/AdminUsersTab";
import AdminModulesTab from "@/components/AdminModulesTab";
import AdminVectorsTab from "@/components/AdminVectorsTab";
import AdminGrowthPointsTab from "@/components/AdminGrowthPointsTab";
import AdminRevenueTab from "@/components/AdminRevenueTab";
import AdminMessagesTab from "@/components/AdminMessagesTab";
import AdminNewsTab from "@/components/AdminNewsTab";
import AdminBlogTab from "@/components/AdminBlogTab";
import AdminSeoTab from "@/components/AdminSeoTab";
import AdminMonitorTab from "@/components/AdminMonitorTab";
import AdminPromoTab from "@/components/AdminPromoTab";
import AdminRiskTemplatesTab from "@/components/AdminRiskTemplatesTab";
import AdminAnalyticsTab from "@/components/AdminAnalyticsTab";
import AdminSearchEnginesTab from "@/components/AdminSearchEnginesTab";
import ScrollTabs from "@/components/ScrollTabs";

type Tab = "search-engines" | "users" | "modules" | "vectors" | "growth-points" | "revenue" | "messages" | "news" | "blog" | "seo" | "monitor" | "risk-templates" | "promo" | "analytics";

const GROUPS: { title: string; tabs: { id: Tab; label: string; icon: string }[] }[] = [
  {
    title: "Клиенты",
    tabs: [
      { id: "users", label: "Пользователи", icon: "☺" },
      { id: "messages", label: "Сообщения", icon: "✉" },
      { id: "promo", label: "Промокоды", icon: "%" },
      { id: "revenue", label: "Выручка", icon: "₽" },
    ],
  },
  {
    title: "Содержимое сервиса",
    tabs: [
      { id: "modules", label: "Модули плана", icon: "▤" },
      { id: "vectors", label: "Векторы аудитории", icon: "◎" },
      { id: "growth-points", label: "Точки роста", icon: "↗" },
      { id: "risk-templates", label: "Типовые угрозы", icon: "⚠" },
      { id: "news", label: "Новости", icon: "◧" },
      { id: "blog", label: "Блог (SEO)", icon: "✎" },
    ],
  },
  {
    title: "Продвижение и данные",
    tabs: [
      { id: "analytics", label: "Аналитика", icon: "◔" },
      { id: "seo", label: "SEO-монитор", icon: "✓" },
      { id: "search-engines", label: "Яндекс и Google", icon: "⌕" },
      { id: "monitor", label: "Мониторинг рисков", icon: "◉" },
    ],
  },
];
const TABS: { id: Tab; label: string }[] = GROUPS.flatMap((g) => g.tabs);
const TAB_IDS = TABS.map((t) => t.id as string);


export default function AdminPage() {
  const [checked, setChecked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>("users");
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const [messagePrefill, setMessagePrefill] = useState<string | null>(null);

  // Открытый раздел помним в адресе (#analytics): обновление страницы не возвращает на «Пользователи»
  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (TAB_IDS.includes(h)) setTab(h as Tab);
  }, []);
  useEffect(() => {
    if (window.location.hash.replace("#", "") !== tab) window.history.replaceState(null, "", "#" + tab);
  }, [tab]);

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

  const goTab = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="min-h-screen bg-soft">
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[88rem] items-center justify-between px-5 py-4 md:px-8">
          <h1 className="font-display text-xl text-ink-900">Админ-панель</h1>
          <div className="flex items-center gap-4">
            <button onClick={logout} className="text-sm text-muted underline underline-offset-4 hover:text-ink-900">
              Выйти
            </button>
            <Link href="/" className="text-sm text-muted underline underline-offset-4 hover:text-ink-900">
              На сайт
            </Link>
          </div>
        </div>
        {/* Телефон и узкий экран: прежняя полоса вкладок */}
        <div className="mx-auto max-w-[88rem] px-5 pb-4 md:px-8 lg:hidden">
          <ScrollTabs tabs={TABS} active={tab} onChange={setTab} />
        </div>
      </div>

      <div className="mx-auto max-w-[88rem] px-5 py-6 md:px-8 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:py-8">
        <nav aria-label="Разделы админки" className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto pr-1">
            {GROUPS.map((g) => (
              <div key={g.title} className="mb-5">
                <p className="mb-1.5 px-3.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.title}</p>
                <ul className="space-y-0.5">
                  {g.tabs.map((t) => {
                    const active = tab === t.id;
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => goTab(t.id)}
                          aria-current={active ? "page" : undefined}
                          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm transition-colors ${
                            active ? "bg-ink-900 font-semibold text-white" : "text-ink-900/75 hover:bg-white hover:text-ink-900"
                          }`}
                        >
                          <span aria-hidden className="w-4 text-center">{t.icon}</span>
                          {t.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0 py-2 lg:py-0">
          {tab === "users" && <AdminUsersTab onMessage={openMessageComposer} />}
          {tab === "messages" && <AdminMessagesTab prefillEmail={messagePrefill} />}
          {tab === "modules" && <AdminModulesTab />}
          {tab === "vectors" && <AdminVectorsTab />}
          {tab === "growth-points" && <AdminGrowthPointsTab />}
          {tab === "news" && <AdminNewsTab />}
          {tab === "blog" && <AdminBlogTab openPostId={editPostId} onOpened={() => setEditPostId(null)} />}
          {tab === "seo" && (
            <AdminSeoTab
              onEditPost={(id) => {
                setEditPostId(id);
                setTab("blog");
              }}
            />
          )}
          {tab === "monitor" && <AdminMonitorTab />}
          {tab === "risk-templates" && <AdminRiskTemplatesTab />}
          {tab === "search-engines" && <AdminSearchEnginesTab />}
          {tab === "analytics" && <AdminAnalyticsTab />}
          {tab === "promo" && <AdminPromoTab />}
          {tab === "revenue" && <AdminRevenueTab />}
        </div>
      </div>
    </main>
  );
}
