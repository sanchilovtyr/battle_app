import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { parseBlogInput, toPrismaData } from "@/lib/blogValidation";
import { pingPendingPosts } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

const requireAdmin = () => verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value);

export async function GET() {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  // coverData намеренно не выбираем — это тяжёлые байты, для списка хватает hasCover
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, slug: true, title: true, excerpt: true, published: true, publishedAt: true,
      hasCover: true, keywords: true, createdAt: true, updatedAt: true,
    },
  });
  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const parsed = parseBlogInput(await req.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const post = await prisma.blogPost.create({
      data: toPrismaData(parsed.data),
      select: { id: true, slug: true },
    });
    // Сразу сообщаем Яндексу и Bing о новой статье (отложенные уйдут по расписанию, когда наступит их время)
    const indexNow = await pingPendingPosts("publish");
    return NextResponse.json({ ok: true, post, indexNow });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") {
      return NextResponse.json({ error: "Статья с таким адресом уже есть — измените адрес" }, { status: 409 });
    }
    console.error("Не удалось создать статью", e);
    return NextResponse.json({ error: "Не удалось сохранить статью" }, { status: 500 });
  }
}
