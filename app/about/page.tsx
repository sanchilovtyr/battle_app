import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { EXECUTOR } from "@/lib/offer";
import { SITE_URL } from "@/lib/blog";
import { SITE_NAME } from "@/lib/geo";

const TITLE = "О сервисе «Ключевое слово» и о том, кто за ним стоит";
const DESCRIPTION =
  "Ключевое слово — сервис персональных планов продвижения для малого бизнеса на основе 15+ лет практики в маркетинге. Методика, тарифы и реквизиты исполнителя.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: { type: "website", locale: "ru_RU", siteName: SITE_NAME, title: TITLE, description: DESCRIPTION, url: `${SITE_URL}/about` },
};

const STEPS = [
  { t: "Анкета из 4 вопросов", d: "Ниша, цель, бюджет и география клиентов. Около 3 минут, без карты и звонка менеджера." },
  { t: "План из трёх этапов", d: "«Фундамент», «Трафик» и «Удержание»: что делать сначала, что потом и почему именно так." },
  { t: "Работа по плану", d: "На платных тарифах — чек-листы с отметками, аналитика «где теряются клиенты» и обновления плана." },
];

export default function AboutPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/about`,
      inLanguage: "ru-RU",
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
      mainEntity: {
        "@type": "Organization",
        name: SITE_NAME,
        legalName: EXECUTOR.fullName,
        url: SITE_URL,
        logo: `${SITE_URL}/logo-mark.png`,
        taxID: EXECUTOR.inn,
        telephone: EXECUTOR.phone,
        address: { "@type": "PostalAddress", addressLocality: EXECUTOR.city, addressCountry: "RU" },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "О сервисе", item: `${SITE_URL}/about` },
      ],
    },
  ];

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <nav aria-label="Хлебные крошки" className="mb-6 text-sm text-muted">
          <Link href="/" className="hover:text-ink-900">Главная</Link> <span aria-hidden>/</span> О сервисе
        </nav>
        <h1 className="mb-5 font-display text-2xl leading-tight tracking-tight text-ink-900 md:text-4xl">
          О сервисе «Ключевое слово»
        </h1>
        <p className="mb-10 text-lg leading-relaxed text-muted">
          Мы помогаем владельцам малого и среднего бизнеса в России разобраться, что делать с продвижением: в каком порядке, какими
          инструментами и на что тратить бюджет. Сервис составляет персональный план по ответам на четыре вопроса.
        </p>

        <section className="mb-10">
          <h2 className="mb-3 font-display text-xl text-ink-900">Откуда методика</h2>
          <div className="space-y-3 text-[15px] leading-relaxed text-ink-900 md:text-base">
            <p>
              В основе сервиса — более 15 лет практической работы в маркетинге с проектами из разных сфер: розница, услуги, общепит,
              B2B, онлайн-школы и интернет-магазины. Планы строятся не из общих советов, а из последовательности шагов, которая
              отличается для каждой ниши и бюджета.
            </p>
            <p>
              Это не чат с нейросетью и не разовая консультация: план остаётся рабочим инструментом, к которому возвращаются, отмечая
              выполненное.
            </p>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-4 font-display text-xl text-ink-900">Как это работает</h2>
          <ol className="space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.t} className="flex gap-4 rounded-2xl border border-line bg-white p-5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-brand">{i + 1}</span>
                <div>
                  <p className="font-medium text-ink-900">{s.t}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-muted">
            Первые два этапа плана доступны бесплатно. Подписка нужна, чтобы открыть весь план, чек-листы, аналитику и обновления:{" "}
            <Link href="/#pricing" className="font-medium text-violet underline underline-offset-4">посмотреть тарифы</Link>.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 font-display text-xl text-ink-900">Кто оказывает услугу</h2>
          <div className="rounded-2xl border border-line bg-soft p-5 text-sm text-ink-900">
            <p className="font-medium">{EXECUTOR.fullName}</p>
            <p className="mt-1 text-muted">{EXECUTOR.country}, г. {EXECUTOR.city}</p>
            <p className="mt-3 text-muted">ОГРНИП: {EXECUTOR.ogrnip}</p>
            <p className="text-muted">ИНН: {EXECUTOR.inn}</p>
            <p className="text-muted">Дата регистрации: {EXECUTOR.registeredAt}</p>
            {EXECUTOR.phone && <p className="mt-3 text-muted">Телефон: {EXECUTOR.phone}</p>}
            <p className="text-muted">Email: {EXECUTOR.email}</p>
          </div>
          <p className="mt-4 text-sm text-muted">
            Условия оказания услуг — в <Link href="/oferta" className="underline underline-offset-4">договоре оферты</Link>, обработка данных —
            в <Link href="/privacy" className="underline underline-offset-4">политике персональных данных</Link>. Написать нам можно через{" "}
            <Link href="/#contact" className="underline underline-offset-4">форму на главной</Link>.
          </p>
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-ink-900">Блог</h2>
          <p className="text-[15px] leading-relaxed text-ink-900 md:text-base">
            В <Link href="/blog" className="font-medium text-violet underline underline-offset-4">блоге</Link> мы разбираем продвижение малого бизнеса
            на практике: с чего начать, как считать результат и куда не стоит тратить деньги.
          </p>
        </section>
      </div>

      <footer className="bg-ink-900 py-7 text-xs text-white/55">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-2 px-5 md:px-8">
          <Link href="/" className="underline underline-offset-4 hover:text-white">Главная</Link>
          <Link href="/blog" className="underline underline-offset-4 hover:text-white">Блог</Link>
          <Link href="/oferta" className="underline underline-offset-4 hover:text-white">Оферта</Link>
          <Link href="/privacy" className="underline underline-offset-4 hover:text-white">Политика конфиденциальности</Link>
        </div>
      </footer>
    </main>
  );
}
