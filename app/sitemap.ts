import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { publishedWhere } from "@/lib/blog";
import { NICHES, nichePath } from "@/lib/niches";

// Список статей берётся из базы на каждый запрос, поэтому sitemap нельзя считать при сборке
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://m-navi.ru";

  let posts: { slug: string; updatedAt: Date }[] = [];
  try {
    posts = (await prisma.blogPost.findMany({
      where: publishedWhere(),
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: "desc" },
    })) as { slug: string; updatedAt: Date }[];
  } catch {
    // Таблицы блога может ещё не быть (до prisma db push) — отдаём sitemap без статей, а не 500
  }

  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/blog`, lastModified: posts[0]?.updatedAt ?? new Date(), changeFrequency: "daily", priority: 0.8 },
    ...posts.map((p) => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...NICHES.map((n) => ({ url: `${base}${nichePath(n.slug)}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/oferta`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
