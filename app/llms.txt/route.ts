import { prisma } from "@/lib/db";
import { publishedWhere } from "@/lib/blog";
import { buildLlmsTxt, PostBrief } from "@/lib/geo";

// Список статей берётся из базы, поэтому файл нельзя посчитать при сборке
export const dynamic = "force-dynamic";

export async function GET() {
  let posts: PostBrief[] = [];
  try {
    posts = (await prisma.blogPost.findMany({
      where: publishedWhere(),
      orderBy: { publishedAt: "desc" },
      take: 50,
      select: { slug: true, title: true, excerpt: true, publishedAt: true },
    })) as PostBrief[];
  } catch {
    // таблицы блога может ещё не быть — отдаём файл без статей
  }
  return new Response(buildLlmsTxt(posts), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
