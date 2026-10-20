"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { slug: "", label: "Обзор плана", icon: "▤" },
  { slug: "vector", label: "Ваш вектор аудитории", icon: "◎" },
  { slug: "dashboard", label: "Дашборд динамики", icon: "◔" },
  { slug: "losses", label: "Где вы теряете клиентов", icon: "▽" },
  { slug: "growth", label: "Точки роста компании", icon: "↗" },
  { slug: "risks", label: "Управление рисками", icon: "⚠" },
  { slug: "unit-economics", label: "Юнит-экономика", icon: "∑" },
  { slug: "clients", label: "Клиенты (CRM)", icon: "☷" },
];

/** Левое меню разделов плана (десктоп) и горизонтальная полоса под шапкой (мобильный). */
export default function BusinessNav({ businessId, businessName }: { businessId: string; businessName?: string }) {
  const pathname = usePathname() || "";
  const base = `/business/${businessId}`;
  const isActive = (slug: string) => (slug ? pathname.startsWith(`${base}/${slug}`) : pathname === base);

  return (
    <>
      {/* Десктоп */}
      <nav aria-label="Разделы плана" className="print:hidden hidden lg:block">
        <div className="sticky top-24">
          <Link href="/account" className="mb-3 inline-block text-sm text-muted underline underline-offset-4 hover:text-ink-900">
            ← Личный кабинет
          </Link>
          {businessName && <p className="mb-3 truncate font-display text-lg text-ink-900">{businessName}</p>}
          <ul className="space-y-1">
            {ITEMS.map((it) => {
              const active = isActive(it.slug);
              return (
                <li key={it.slug}>
                  <Link
                    href={it.slug ? `${base}/${it.slug}` : base}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors ${
                      active ? "bg-ink-900 font-semibold text-white" : "text-ink-900/75 hover:bg-soft hover:text-ink-900"
                    }`}
                  >
                    <span aria-hidden className="w-4 text-center">{it.icon}</span>
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Мобильный */}
      <nav
        aria-label="Разделы плана"
        className="print:hidden sticky top-[68px] z-40 -mx-5 border-b border-line sm:top-[76px] md:-mx-8 bg-white/95 backdrop-blur lg:hidden"
      >
        <ul className="flex gap-2 overflow-x-auto px-5 py-2.5 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ITEMS.map((it) => {
            const active = isActive(it.slug);
            return (
              <li key={it.slug} className="shrink-0">
                <Link
                  href={it.slug ? `${base}/${it.slug}` : base}
                  aria-current={active ? "page" : undefined}
                  ref={(el) => {
                    if (el && active) el.scrollIntoView({ inline: "center", block: "nearest" });
                  }}
                  className={`block whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm ${
                    active ? "border-ink-900 bg-ink-900 font-semibold text-white" : "border-line text-ink-900/75"
                  }`}
                >
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
