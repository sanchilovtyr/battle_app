import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { parseBlogInput, toPrismaData } from "@/lib/blogValidation";
import { pingPendingPosts, pingUrls } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

const requireAdmin = () => verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value);

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const post = await prisma.blogPost.findUnique({
    where: { id: params.id },
    select: {
      id: true, slug: true, title: true, excerpt: true, body: true, coverAlt: true, metaTitle: true,
      metaDescription: true, keywords: true, authorName: true, authorRole: true, authorBio: true, published: true, publishedAt: true, hasCover: true, updatedAt: true,
    },
  });
  if (!post) return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
  return NextResponse.json({ post });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const existing = await prisma.blogPost.findUnique({
    where: { id: params.id },
    select: { publishedAt: true, published: true, slug: true },
  });
  if (!existing) return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });

  const parsed = parseBlogInput(await req.json().catch(() => ({})), existing.publishedAt);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const post = await prisma.blogPost.update({
      where: { id: params.id },
      data: toPrismaData(parsed.data),
      select: { id: true, slug: true },
    });
    const wasLive = existing.published && existing.publishedAt !== null && existing.publishedAt <= new Date();
    // Снята с публикации или сменился адрес — просим перепроверить старый адрес, чтобы он ушёл из поиска
    const oldGone = wasLive && (!parsed.data.published || parsed.data.slug !== existing.slug);
    if (oldGone) await pingUrls([`/blog/${existing.slug}`, "/blog"], "publish");
    const indexNow = await pingPendingPosts("publish");
    return NextResponse.json({ ok: true, post, indexNow });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Статья с таким адресом уже есть — измените адрес" }, { status: 409 });
    }
    console.error("Не удалось обновить статью", e);
    return NextResponse.json({ error: "Не удалось сохранить статью" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  try {
    const before = await prisma.blogPost.findUnique({ where: { id: params.id }, select: { slug: true, published: true } });
    await prisma.blogPost.delete({ where: { id: params.id } });
    if (before?.published) await pingUrls([`/blog/${before.slug}`, "/blog"], "publish");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
  }
}
