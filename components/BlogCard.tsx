import Link from "next/link";
import { BlogCard as Card, coverUrl, formatDate, plainSummary, readingMinutes } from "@/lib/blog";

/** eager — картинки первого экрана грузим сразу, остальные лениво (быстрее первая отрисовка) */
export default function BlogCard({ post, eager = false }: { post: Card; eager?: boolean }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-transform hover:-translate-y-0.5">
      <Link href={`/blog/${post.slug}`} className="flex flex-1 flex-col" aria-label={post.title}>
        {post.hasCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl(post.slug, post.updatedAt)}
            alt={post.coverAlt || post.title}
            width={1200}
            height={630}
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            className="aspect-[1200/630] w-full bg-soft object-cover"
          />
        ) : (
          <div className="flex aspect-[1200/630] w-full items-center justify-center bg-ink-900 text-3xl text-brand">→</div>
        )}
        <div className="flex flex-1 flex-col p-5 md:p-6">
          <p className="mb-2 font-mono text-xs uppercase tracking-wide text-violet">
            {formatDate(post.publishedAt)} · {readingMinutes(post.body)} мин
          </p>
          <h2 className="mb-2 font-display text-lg leading-snug tracking-tight text-ink-900">{post.title}</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted">{plainSummary(post.excerpt, post.body)}</p>
          <span className="mt-auto text-[13px] font-bold text-ink-900">
            Читать статью <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </div>
      </Link>
    </article>
  );
}
