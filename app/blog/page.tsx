import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import BlogCard from "@/components/BlogCard";
import { prisma } from "@/lib/db";
import { BLOG_PAGE_SIZE, BlogCard as Card, SITE_URL, publishedWhere } from "@/lib/blog";

export const dynamic = "force-dynamic";

const TITLE = "Блог о маркетинге для малого бизнеса — Ключевое слово";
const DESCRIPTION =
  "Практические статьи о продвижении малого и среднего бизнеса: как привлекать клиентов из интернета, выбирать каналы рекламы и считать результат — простым языком, без воды.";

function pageNumber(raw?: string): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 1 ? n : 1;
}

export async function generateMetadata({ searchParams }: { searchParams: { page?: string } }): Promise<Metadata> {
  const page = pageNumber(searchParams.page);
  const canonical = page > 1 ? `/blog?page=${page}` : "/blog";
  return {
    title: page > 1 ? `${TITLE} — страница ${page}` : TITLE,
    description: DESCRIPTION,
    alternates: { canonical, types: { "application/rss+xml": `${SITE_URL}/blog/rss.xml` } },
    openGraph: { type: "website", locale: "ru_RU", siteName: "Ключевое слово", title: TITLE, description: DESCRIPTION, url: `${SITE_URL}${canonical}` },
  };
}

export default async function BlogIndex({ searchParams }: { searchParams: { page?: string } }) {
  const page = pageNumber(searchParams.page);
  const where = publishedWhere();
  let total = 0;
  let posts: Card[] = [];
  try {
    [total, posts] = (await Promise.all([
      prisma.blogPost.count({ where }),
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * BLOG_PAGE_SIZE,
        take: BLOG_PAGE_SIZE,
        select: { id: true, slug: true, title: true, excerpt: true, body: true, coverAlt: true, hasCover: true, publishedAt: true, updatedAt: true },
      }),
    ])) as [number, Card[]];
  } catch (e) {
    // Таблицы блога может ещё не быть (до prisma db push) — показываем пустой блог, а не 500
    console.error("Блог: не удалось прочитать статьи", e);
  }
  const pages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Блог «Ключевое слово»",
    url: `${SITE_URL}/blog`,
    description: DESCRIPTION,
    blogPost: posts.map((p) => ({ "@type": "BlogPosting", headline: p.title, url: `${SITE_URL}/blog/${p.slug}` })),
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-5 py-12 md:px-8 md:py-16">
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-violet">Блог</p>
        <h1 className="mb-3 font-display text-3xl tracking-tight text-ink-900 md:text-4xl">
          Маркетинг простым языком
        </h1>
        <p className="mb-10 max-w-2xl text-muted md:text-lg">
          Как привлекать клиентов из интернета, не тратя бюджет вслепую: разборы, чек-листы и честные цифры.
        </p>

        {posts.length === 0 ? (
          <p className="rounded-2xl border border-line bg-soft p-8 text-center text-muted">
            Первые статьи скоро появятся. А пока можно{" "}
            <Link href="/#wizard" className="font-medium text-violet underline underline-offset-4">
              построить свой план продвижения
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p, i) => (
              <BlogCard key={p.id} post={p} eager={i < 3} />
            ))}
          </div>
        )}

        {pages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-3 text-sm" aria-label="Страницы блога">
            {page > 1 && (
              <Link href={page === 2 ? "/blog" : `/blog?page=${page - 1}`} rel="prev" className="rounded-full border border-line px-4 py-2 font-medium hover:bg-soft">
                ← Новее
              </Link>
            )}
            <span className="text-muted">
              {page} из {pages}
            </span>
            {page < pages && (
              <Link href={`/blog?page=${page + 1}`} rel="next" className="rounded-full border border-line px-4 py-2 font-medium hover:bg-soft">
                Старее →
              </Link>
            )}
          </nav>
        )}
      </div>
      <footer className="bg-ink-900 py-7 text-xs text-white/55">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-2 px-5 md:px-8">
          <Link href="/" className="underline underline-offset-4 hover:text-white">Главная</Link>
          <Link href="/oferta" className="underline underline-offset-4 hover:text-white">Оферта</Link>
          <Link href="/privacy" className="underline underline-offset-4 hover:text-white">Политика конфиденциальности</Link>
        </div>
      </footer>
    </main>
  );
}
