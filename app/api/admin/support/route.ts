import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { parseImageDataUrl } from "@/lib/blog";
import { SUPPORT_MAX_BODY, toClientMessage, type SupportThread } from "@/lib/supportShared";

export const dynamic = "force-dynamic";

function isAdmin(): boolean {
  return verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value);
}

/** Все тикеты: переписки сгруппированы по пользователю, свежие сверху. */
export async function GET() {
  if (!isAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { supportMessages: { some: {} } },
    select: {
      email: true,
      supportClosed: true,
      supportMessages: { orderBy: { createdAt: "asc" }, select: { id: true, from: true, body: true, createdAt: true } },
    },
  });
  const withImage = await prisma.supportMessage.findMany({ where: { image: { not: null } }, select: { id: true } });
  const imgIds = new Set(withImage.map((r: { id: string }) => r.id));

  const threads: SupportThread[] = users
    .map((u: any) => {
      const messages = u.supportMessages.map((m: any) => toClientMessage({ ...m, hasImage: imgIds.has(m.id) }, u.email));
      return { email: u.email, messages, lastAt: messages[messages.length - 1].createdAt, closed: Boolean(u.supportClosed) };
    })
    .sort((a: SupportThread, b: SupportThread) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  return NextResponse.json({ threads });
}

/** Ответ поддержки пользователю по email. */
export async function POST(req: Request) {
  if (!isAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const email = String(raw?.email ?? "").trim().toLowerCase();
  const body = String(raw?.body ?? "").trim().slice(0, SUPPORT_MAX_BODY);
  const imageData = raw?.image ? parseImageDataUrl(String(raw.image)) : null;
  if (raw?.image && !imageData) return NextResponse.json({ error: "Картинка не подходит (jpeg, png или webp до 900 КБ)" }, { status: 400 });
  if (!email || (!body && !imageData)) return NextResponse.json({ error: "Укажите email и текст" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Пользователь с таким email не найден" }, { status: 404 });

  await prisma.supportMessage.create({ data: { userId: user.id, from: "admin", body, ...(imageData ? { image: imageData } : {}) } });
  return NextResponse.json({ ok: true });
}

/** Закрыть или снова открыть тикет. */
export async function PATCH(req: Request) {
  if (!isAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const raw = await req.json().catch(() => ({}));
  const email = String(raw?.email ?? "").trim().toLowerCase();
  if (!email || typeof raw?.closed !== "boolean") return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const res = await prisma.user.updateMany({ where: { email }, data: { supportClosed: raw.closed } });
  if (res.count === 0) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
