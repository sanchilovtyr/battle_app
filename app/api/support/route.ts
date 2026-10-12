import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { parseImageDataUrl } from "@/lib/blog";
import { checkRateLimit } from "@/lib/rateLimit";
import { SUPPORT_MAX_BODY, toClientMessage } from "@/lib/supportShared";

export const dynamic = "force-dynamic";

const SELECT = { id: true, from: true, body: true, createdAt: true, image: true } as const;

/** Переписка текущего пользователя с поддержкой — с любого устройства. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const [rows, u] = await Promise.all([
    prisma.supportMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, take: 500, select: { id: true, from: true, body: true, createdAt: true } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { supportClosed: true } }),
  ]);
  // Признак вложения без выгрузки самих байт
  const withImage = await prisma.supportMessage.findMany({ where: { userId: user.id, image: { not: null } }, select: { id: true } });
  const imgIds = new Set(withImage.map((r: { id: string }) => r.id));
  return NextResponse.json({
    messages: rows.map((m: any) => toClientMessage({ ...m, hasImage: imgIds.has(m.id) }, user.email ?? "")),
    closed: Boolean(u?.supportClosed),
  });
}

/** Новое сообщение пользователя. Закрытый тикет открывается снова. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  if (!checkRateLimit(`support:${user.id}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Слишком много сообщений. Попробуйте через несколько минут." }, { status: 429 });
  }

  const raw = await req.json().catch(() => ({}));
  const body = String(raw?.body ?? "").trim().slice(0, SUPPORT_MAX_BODY);
  const imageData = raw?.image ? parseImageDataUrl(String(raw.image)) : null;
  if (raw?.image && !imageData) {
    return NextResponse.json({ error: "Не удалось принять картинку (jpeg, png или webp до 900 КБ)" }, { status: 400 });
  }
  if (!body && !imageData) return NextResponse.json({ error: "Напишите сообщение" }, { status: 400 });

  const msg = await prisma.supportMessage.create({
    data: { userId: user.id, from: "user", body, ...(imageData ? { image: imageData } : {}) },
    select: SELECT,
  });
  await prisma.user.update({ where: { id: user.id }, data: { supportClosed: false } });
  return NextResponse.json({ ok: true, message: toClientMessage(msg, user.email ?? "") });
}
