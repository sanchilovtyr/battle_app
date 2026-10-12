import { prisma } from "@/lib/db";
import { publishedWhere } from "@/lib/blog";
import { buildLlmsFullTxt, PostBrief } from "@/lib/geo";

export const dynamic = "force-dynamic";

export async function GET() {
  let posts: PostBrief[] = [];
  try {
    posts = (await prisma.blogPost.findMany({
      where: publishedWhere(),
      orderBy: { publishedAt: "desc" },
      take: 30,
      select: { slug: true, title: true, excerpt: true, body: true, publishedAt: true },
    })) as PostBrief[];
  } catch {
    // таблицы блога может ещё не быть — отдаём файл без статей
  }
  return new Response(buildLlmsFullTxt(posts), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
