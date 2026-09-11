import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

interface NewsPostRow {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
}

export async function GET() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const [posts, user] = (await Promise.all([
    prisma.newsPost.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.user.findUnique({ where: { id: sessionUser.id }, select: { newsSeenAt: true } }),
  ])) as [NewsPostRow[], { newsSeenAt: Date | null } | null];

  const seenAt = user?.newsSeenAt ?? null;
  const hasUnread = posts.some((p) => !seenAt || p.createdAt > seenAt);

  return NextResponse.json({ posts, hasUnread });
}

export async function POST() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  await prisma.user.update({ where: { id: sessionUser.id }, data: { newsSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
