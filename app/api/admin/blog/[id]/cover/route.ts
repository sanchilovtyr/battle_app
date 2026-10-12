import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { sniffImageMime } from "@/lib/blog";

export const dynamic = "force-dynamic";

/** Обложка для предпросмотра в админке — отдаётся и у черновиков, которых публичный /blog/cover не покажет */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const post = await prisma.blogPost.findUnique({ where: { id: params.id }, select: { coverData: true } });
  if (!post?.coverData) return new Response("Not found", { status: 404 });
  const bytes = new Uint8Array(post.coverData);
  return new Response(bytes, { headers: { "Content-Type": sniffImageMime(bytes), "Cache-Control": "private, no-store" } });
}
