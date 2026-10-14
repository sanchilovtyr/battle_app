import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseBlogInput, toPrismaData } from "@/lib/blogValidation";
import { pingPendingPosts } from "@/lib/indexnow";
import { verifyPublishKey } from "@/lib/publishKey";
import { MAX_QUEUE, bearerFrom, checkPublishMode, makeFailLimiter } from "@/lib/publishKeyCore";

export const dynamic = "force-dynamic";

const limiter = makeFailLimiter();

async function authorize(req: Request): Promise<NextResponse | null> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limiter.blocked(ip)) return NextResponse.json({ error: "Слишком много неверных попыток, подождите несколько минут" }, { status: 429 });
  const ok = await verifyPublishKey(bearerFrom(req.headers.get("authorization")));
  if (!ok) {
    limiter.fail(ip);
    return NextResponse.json({ error: "Неверный или отозванный ключ публикации" }, { status: 401 });
  }
  return null;
}

/** Список статей (заголовки, адреса, даты) — чтобы не писать повторы. Тексты не отдаются. */
export async function GET(req: Request) {
  const denied = await authorize(req);
  if (denied) return denied;
  const posts = await prisma.blogPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { slug: true, title: true, published: true, publishedAt: true, keywords: true },
  });
  return NextResponse.json({ posts });
}

/**
 * Создаёт статью с отложенной публикацией (publishMode "schedule" + publishAt) или черновик (publishMode "draft").
 * Сразу опубликовать по ключу нельзя: статья всегда ждёт минимум час, чтобы её можно было проверить и отменить в админке.
 * Поля те же, что в админке: title, slug, excerpt, body, coverAlt, metaTitle, metaDescription, keywords[], authorName, authorRole, authorBio, cover (data:image/...;base64).
 */
export async function POST(req: Request) {
  const denied = await authorize(req);
  if (denied) return denied;

  const raw = await req.json().catch(() => ({}));
  const mode = checkPublishMode(raw);
  if (!mode.ok) return NextResponse.json({ error: mode.error }, { status: 400 });
  const parsed = parseBlogInput(raw);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const queued = await prisma.blogPost.count({ where: { published: true, publishedAt: { gt: new Date() } } });
  if (parsed.data.published && queued >= MAX_QUEUE) {
    return NextResponse.json({ error: `В очереди уже ${queued} статей — дождитесь публикации или удалите лишние в админке` }, { status: 409 });
  }

  try {
    const post = await prisma.blogPost.create({ data: toPrismaData(parsed.data), select: { id: true, slug: true, publishedAt: true, published: true } });
    // отложенные статьи уйдут в IndexNow, когда наступит их время (pingPendingPosts вызывается и по расписанию)
    await pingPendingPosts("publish").catch(() => {});
    return NextResponse.json({ ok: true, post });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") return NextResponse.json({ error: "Статья с таким адресом уже есть — измените slug" }, { status: 409 });
    console.error("Не удалось создать статью по ключу", e);
    return NextResponse.json({ error: "Не удалось сохранить статью" }, { status: 500 });
  }
}
