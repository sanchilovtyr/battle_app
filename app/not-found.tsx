import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Страница не найдена",
  robots: { index: false, follow: true },
};

const LINKS = [
  { href: "/", label: "Главная" },
  { href: "/blog", label: "Блог" },
  { href: "/about", label: "О сервисе" },
  { href: "/account", label: "Личный кабинет" },
];

/** Страница 404: с понятной ссылкой на главную и основные разделы — человек и поисковый робот не упираются в тупик */
export default function NotFound() {
  return (
    <main>
      <SiteHeader />
      <section className="bg-ink-900 text-white">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center md:py-28">
          <p className="mb-3 font-display text-6xl text-brand md:text-7xl">404</p>
          <h1 className="mb-3 font-display text-2xl tracking-tight md:text-3xl">Такой страницы нет</h1>
          <p className="mx-auto mb-8 max-w-md text-white/65">
            Возможно, адрес изменился или в нём опечатка. Вернитесь на главную или выберите раздел.
          </p>
          <Link
            href="/"
            className="inline-block rounded-[9px] bg-brand px-6 py-3.5 text-sm font-extrabold text-ink-900 transition-transform hover:-translate-y-0.5"
          >
            Перейти на главную
          </Link>
          <ul className="mt-8 flex flex-wrap justify-center gap-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="inline-block rounded-full border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
