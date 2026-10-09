"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";

const NAV = [
  { href: "/about", label: "О нас" },
  { href: "/#pricing", label: "Цены" },
  { href: "/blog", label: "Блог" },
];

export default function SiteHeader({ ctaHref = "/#wizard" }: { ctaHref?: string }) {
  const { status } = useSession();
  const [hasUnreadNews, setHasUnreadNews] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/news")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setHasUnreadNews(Boolean(data?.hasUnread)))
      .catch(() => {});
  }, [status]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-900">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-3 px-4 sm:h-[76px] sm:gap-4 sm:px-5 md:px-8">
        <Link href="/" className="flex shrink-0 items-center">
          <Image
            src="/logo-mark.png"
            alt="Ключевое слово"
            width={106}
            height={47}
            priority
            className="h-8 w-auto sm:hidden"
          />
          <Image
            src="/logo-full.png"
            alt="Ключевое слово — маркетинговое агентство"
            width={264}
            height={47}
            priority
            className="hidden h-9 w-auto sm:block"
          />
        </Link>
        <div className="flex items-center gap-2.5 sm:gap-5">
          <Link
            href="/account"
            aria-label="Личный кабинет"
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-[11px] font-bold text-white transition-transform hover:-translate-y-0.5 hover:bg-white/10 sm:hidden"
          >
            ЛК
            {hasUnreadNews && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-ink-900" />
            )}
          </Link>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden text-sm font-medium text-white/75 transition-transform hover:-translate-y-0.5 hover:text-white sm:block"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/account"
            className="relative hidden text-sm font-medium text-white/75 transition-transform hover:-translate-y-0.5 hover:text-white sm:block"
          >
            Личный кабинет
            {hasUnreadNews && (
              <span className="absolute -right-3 -top-1 h-2 w-2 rounded-full bg-brand" />
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10 sm:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              {menuOpen ? <path d="M3 3l10 10M13 3L3 13" /> : <path d="M2 4h12M2 8h12M2 12h12" />}
            </svg>
          </button>
          <a
            href={ctaHref}
            className="whitespace-nowrap rounded-[9px] bg-brand px-3.5 py-2.5 text-xs font-extrabold text-ink-900 shadow-[0_10px_25px_rgba(0,0,0,0.1)] transition-transform hover:-translate-y-0.5 sm:px-5 sm:py-3 sm:text-sm"
          >
            Построить план
          </a>
        </div>
      </div>
      {menuOpen && (
        <nav id="mobile-nav" aria-label="Меню" className="border-t border-white/10 bg-ink-900 sm:hidden">
          <ul className="mx-auto max-w-6xl px-4 py-2">
            {[...NAV, { href: "/account", label: "Личный кабинет" }].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="block border-b border-white/10 py-3.5 text-base font-medium text-white/85 last:border-b-0 hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
