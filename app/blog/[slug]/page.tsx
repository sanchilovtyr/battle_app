import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/SiteHeader";
import BlogCardView from "@/components/BlogCard";
import Markdown from "@/components/Markdown";
import { prisma } from "@/lib/db";
import { BlogCard, SITE_URL, coverUrl, formatDate, plainSummary, publishedWhere, readingMinutes } from "@/lib/blog";

export const dynamic = "force-dynamic";

interface Post extends BlogCard {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  authorName: string;
  authorRole: string;
  authorBio: string;
  createdAt: Date;
}

async function getPost(slug: string): Promise<Post | null> {
  return (await prisma.blogPost.findFirst({
    where: { slug, ...publishedWhere() },
    select: {
      id: true, slug: true, title: true, excerpt: true, body: true, coverAlt: true, hasCover: true,
      metaTitle: true, metaDescription: true, keywords: true, authorName: true, authorRole: true, authorBio: true, publishedAt: true, createdAt: true, updatedAt: true,
    },
  })) as Post | null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Статья не найдена", robots: { index: false } };

  const title = post.metaTitle || post.title;
  const description = post.metaDescription || plainSummary(post.excerpt, post.body);
  const url = `${SITE_URL}/blog/${post.slug}`;
  const image = post.hasCover ? `${SITE_URL}${coverUrl(post.slug, post.updatedAt)}` : undefined;

  return {
    title,
    description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      locale: "ru_RU",
      siteName: "Ключевое слово",
      title,
      description,
      url,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: post.coverAlt || post.title }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function BlogArticle({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  const related = (await prisma.blogPost.findMany({
    where: { ...publishedWhere(), NOT: { id: post.id } },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: { id: true, slug: true, title: true, excerpt: true, body: true, coverAlt: true, hasCover: true, publishedAt: true, updatedAt: true },
  })) as BlogCard[];

  const url = `${SITE_URL}/blog/${post.slug}`;
  // «Обновлено» показываем, только если правка была заметно позже выхода статьи
  const updatedLater =
    post.publishedAt && post.updatedAt.getTime() - post.publishedAt.getTime() > 24 * 60 * 60 * 1000;
  const description = post.metaDescription || plainSummary(post.excerpt, post.body);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description,
      inLanguage: "ru-RU",
      mainEntityOfPage: url,
      datePublished: post.publishedAt?.toISOString(),
      dateModified: post.updatedAt.toISOString(),
      keywords: post.keywords.join(", "),
      ...(post.hasCover ? { image: [`${SITE_URL}${coverUrl(post.slug, post.updatedAt)}`] } : {}),
      author: post.authorName
        ? {
            "@type": "Person",
            name: post.authorName,
            ...(post.authorRole ? { jobTitle: post.authorRole } : {}),
            ...(post.authorBio ? { description: post.authorBio } : {}),
            worksFor: { "@type": "Organization", name: "Ключевое слово", url: SITE_URL },
          }
        : { "@type": "Organization", name: "Ключевое слово" },
      publisher: { "@type": "Organization", name: "Ключевое слово", url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/logo-mark.png` } },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Главная", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Блог", item: `${SITE_URL}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
  ];

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-5 py-10 md:px-8 md:py-14">
        <nav aria-label="Хлебные крошки" className="mb-6 text-sm text-muted">
          <Link href="/" className="hover:text-ink-900">Главная</Link> <span aria-hidden>/</span>{" "}
          <Link href="/blog" className="hover:text-ink-900">Блог</Link>
        </nav>
        <p className="mb-3 font-mono text-xs uppercase tracking-wide text-violet">
          {formatDate(post.publishedAt)} · {readingMinutes(post.body)} мин чтения
          {updatedLater && <> · обновлено {formatDate(post.updatedAt)}</>}
        </p>
        <h1 className="mb-5 font-display text-2xl leading-tight tracking-tight text-ink-900 md:text-4xl">{post.title}</h1>
        {post.excerpt && <p className="mb-6 text-lg leading-relaxed text-muted">{post.excerpt}</p>}
        <p className="mb-8 text-sm text-muted">
          {post.authorName ? (
            <>
              Автор: <span className="font-medium text-ink-900">{post.authorName}</span>
              {post.authorRole && <>, {post.authorRole}</>}
            </>
          ) : (
            <>Редакция «Ключевое слово»</>
          )}{" "}
          · <Link href="/about" className="underline underline-offset-4 hover:text-ink-900">О сервисе</Link>
        </p>
        {post.hasCover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl(post.slug, post.updatedAt)}
            alt={post.coverAlt || post.title}
            width={1200}
            height={630}
            // Обложка — главная картинка первого экрана: грузим с приоритетом
            fetchPriority="high"
            decoding="async"
            className="mb-10 aspect-[1200/630] w-full rounded-2xl border border-line object-cover"
          />
        )}
        <Markdown source={post.body} />

        {post.authorName && (
          <aside className="mt-12 rounded-2xl border border-line bg-soft p-5 md:p-6" aria-label="Об авторе">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-900/60">Об авторе</p>
            <p className="font-display text-base text-ink-900">{post.authorName}</p>
            {post.authorRole && <p className="text-sm text-muted">{post.authorRole}</p>}
            {post.authorBio && <p className="mt-2 text-sm leading-relaxed text-ink-900">{post.authorBio}</p>}
          </aside>
        )}

        <a
          href="/#wizard"
          className="group mt-14 block rounded-2xl bg-ink-900 p-6 transition-colors hover:bg-ink-800 md:p-8"
        >
          <p className="font-display text-lg leading-snug text-white md:text-xl">
            Хватит читать про маркетинг — получите свой план продвижения за 3 минуты.
          </p>
          <div className="mt-4 flex items-center gap-1.5 text-[13px] font-bold text-brand">
            Заполнить анкету
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </div>
        </a>
      </article>

      {related.length > 0 && (
        <section className="border-t border-line bg-soft py-12">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <h2 className="mb-6 font-display text-xl text-ink-900">Читайте также</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <BlogCardView key={p.id} post={p} />
              ))}
            </div>
          </div>
        </section>
      )}
      <footer className="bg-ink-900 py-7 text-xs text-white/55">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-5 gap-y-2 px-5 md:px-8">
          <Link href="/" className="underline underline-offset-4 hover:text-white">Главная</Link>
          <Link href="/blog" className="underline underline-offset-4 hover:text-white">Блог</Link>
          <Link href="/about" className="underline underline-offset-4 hover:text-white">О сервисе</Link>
          <Link href="/oferta" className="underline underline-offset-4 hover:text-white">Оферта</Link>
          <Link href="/privacy" className="underline underline-offset-4 hover:text-white">Политика конфиденциальности</Link>
        </div>
      </footer>
    </main>
  );
}
