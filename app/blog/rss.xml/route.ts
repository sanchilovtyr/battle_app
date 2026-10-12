import { prisma } from "@/lib/db";
import { SITE_URL, plainSummary, publishedWhere } from "@/lib/blog";

export const dynamic = "force-dynamic";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const posts = (await prisma.blogPost.findMany({
    where: publishedWhere(),
    orderBy: { publishedAt: "desc" },
    take: 30,
    select: { slug: true, title: true, excerpt: true, body: true, publishedAt: true },
  })) as { slug: string; title: string; excerpt: string; body: string; publishedAt: Date | null }[];

  const items = posts
    .map(
      (p) => `<item><title>${esc(p.title)}</title><link>${SITE_URL}/blog/${p.slug}</link><guid isPermaLink="true">${SITE_URL}/blog/${p.slug}</guid>${
        p.publishedAt ? `<pubDate>${p.publishedAt.toUTCString()}</pubDate>` : ""
      }<description>${esc(plainSummary(p.excerpt, p.body, 300))}</description></item>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Блог «Ключевое слово»</title><link>${SITE_URL}/blog</link><description>Маркетинг для малого бизнеса простым языком</description><language>ru</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
