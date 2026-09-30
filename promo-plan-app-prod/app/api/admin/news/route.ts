import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

function requireAdmin(): boolean {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

export async function GET() {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const posts = await prisma.newsPost.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim().slice(0, 200);
  const text = String(body?.body ?? "").trim().slice(0, 5000);

  if (!title || !text) {
    return NextResponse.json({ error: "Заполните заголовок и текст" }, { status: 400 });
  }

  const post = await prisma.newsPost.create({ data: { title, body: text } });
  return NextResponse.json({ ok: true, post });
}
