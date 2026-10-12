import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import { CASES } from "@/lib/cases";
import { NICHES, getNiche, nichePath } from "@/lib/niches";
import { MODULES } from "@/lib/modules";
import { generatePlan } from "@/lib/ruleEngine";
import { SITE_URL } from "@/lib/blog";
import { SITE_NAME } from "@/lib/geo";
import type { PlanEntry } from "@/lib/types";

// Страницы статические: пример плана считается чистым движком без базы
export function generateStaticParams() {
  return NICHES.map((n) => ({ niche: n.slug }));
}

export function generateMetadata({ params }: { params: { niche: string } }): Metadata {
  const n = getNiche(params.niche);
  if (!n) return {};
  const url = `${SITE_URL}${nichePath(n.slug)}`;
  return {
    title: n.metaTitle,
    description: n.metaDescription,
    alternates: { canonical: nichePath(n.slug) },
    openGraph: { type: "website", locale: "ru_RU", siteName: SITE_NAME, title: n.metaTitle, description: n.metaDescription, url },
  };
}

function PlanBlock({ title, entries }: { title: string; entries: PlanEntry[] }) {
  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <ol className="space-y-3">
        {entries.map((e, i) => (
          <li key={e.module.id} className="rounded-2xl border border-line bg-white p-5">
            <p className="font-medium text-ink-900">
              {i + 1}. {e.module.title}
            </p>
            <p className="mt-1 text-xs text-muted">{e.module.timeToResult}</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-900">{e.reason}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
              {e.module.steps.slice(0, 3).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function NichePage({ params }: { params: { niche: string } }) {
  const n = getNiche(params.niche);
  if (!n) notFound();

  const plan = generatePlan(MODULES, n.exampleAnswers);
  const cases = n.caseTitles.map((t) => CASES.find((c) => c.title === t)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const others = NICHES.filter((x) => x.slug !== n.slug);
  const url = `${SITE_URL}${nichePath(n.slug)}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: n.metaTitle,
      description: n.metaDescription,
      url,
      inLanguage: "ru-RU",
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: n.name, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: n.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    },
  ];

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <nav aria-label="Хлебные крошки" className="mb-6 text-sm text-muted">
          <Link href="/" className="hover:text-ink-900">Главная</Link> <span aria-hidden>/</span> {n.name}
        </nav>
        <h1 className="mb-5 font-display text-2xl leading-tight tracking-tight text-ink-900 md:text-4xl">{n.h1}</h1>
        <p className="mb-8 text-lg leading-relaxed text-muted">{n.lead}</p>
        <Link
          href="/#wizard"
          className="mb-12 inline-block rounded-full bg-ink-900 px-6 py-3 text-sm font-medium text-white hover:bg-ink-900/90"
        >
          Получить свой план за 3 минуты
        </Link>

        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl text-ink-900">{n.obstaclesTitle}</h2>
          <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-900 md:text-base">
            {n.obstacles.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="mb-2 font-display text-xl text-ink-900">Пример плана для вашей ниши</h2>
          <p className="mb-5 text-sm text-muted">
            Построен нашим движком для типового случая: {n.exampleDescription} Ваш план зависит от ваших ответов. Показаны первые два
            этапа; этап «Удержание» открывается на платных тарифах.
          </p>
          <PlanBlock title="Этап 1. Фундамент" entries={plan.foundation} />
          <PlanBlock title="Этап 2. Трафик" entries={plan.traffic} />
        </section>

        {cases.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-2 font-display text-xl text-ink-900">Кейсы нашего агентства</h2>
            <p className="mb-5 text-sm text-muted">
              Это результаты, которые наша команда получила как агентство до запуска сервиса «Ключевое слово». Это не результаты
              сервиса и не гарантия такого же итога в вашем бизнесе.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {cases.map((c) => (
                <article key={c.title} className="rounded-2xl border border-line bg-soft p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-violet">{c.type}</p>
                  <h3 className="mt-1 font-medium text-ink-900">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{c.problem}</p>
                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                    {c.metrics.map((m) => (
                      <div key={m.l}>
                        <dt className="text-xs text-muted">{m.l}</dt>
                        <dd className="font-display text-xl text-ink-900">{m.v}</dd>
                      </div>
                    ))}
                  </dl>
                  {c.steps && c.steps.length > 0 && (
                    <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-sm text-muted">
                      {c.steps.map((st) => (
                        <li key={st}>{st}</li>
                      ))}
                    </ol>
                  )}
                  <p className="mt-3 text-xs text-muted">Канал: {c.channel}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mb-12">
          <h2 className="mb-4 font-display text-xl text-ink-900">Частые вопросы</h2>
          <div className="divide-y divide-line rounded-2xl border border-line bg-white">
            {n.faq.map((f) => (
              <div key={f.q} className="p-5">
                <h3 className="font-medium text-ink-900">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10 rounded-2xl bg-ink-900 p-6 text-white md:p-8">
          <h2 className="font-display text-xl">Получите план под свой бизнес</h2>
          <p className="mt-2 text-sm text-white/70">
            Ответьте на 4 вопроса: ниша, цель, бюджет и география клиентов. Первые два этапа плана бесплатны.
          </p>
          <Link href="/#wizard" className="mt-4 inline-block rounded-full bg-brand px-6 py-3 text-sm font-medium text-ink-900">
            Построить план
          </Link>
        </section>

        <nav aria-label="Другие ниши">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Другие ниши</h2>
          <ul className="flex flex-wrap gap-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={nichePath(o.slug)} className="inline-block rounded-full border border-line px-4 py-2 text-sm text-ink-900 hover:bg-soft">
                  {o.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
}
