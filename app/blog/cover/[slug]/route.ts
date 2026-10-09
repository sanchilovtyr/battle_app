import { prisma } from "@/lib/db";
import { publishedWhere, sniffImageMime } from "@/lib/blog";

// Без этого Next попытается вычислить роут при сборке, когда таблицы ещё нет
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const post = await prisma.blogPost.findFirst({
    where: { slug: params.slug, ...publishedWhere() },
    select: { coverData: true },
  });
  if (!post?.coverData) return new Response("Not found", { status: 404 });

  const bytes = new Uint8Array(post.coverData);
  return new Response(bytes, {
    headers: {
      "Content-Type": sniffImageMime(bytes),
      // В адресе есть ?v=<updatedAt>, поэтому кэш можно делать долгим
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
