import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { SUPPORT_MAX_BODY, SUPPORT_MAX_IMPORT } from "@/lib/supportShared";

export const dynamic = "force-dynamic";

/** Разовый перенос старых сообщений пользователя из браузера (до перехода на серверное хранение).
 *  Принимаются только сообщения от пользователя и только если на сервере ещё нет переписки. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const existing = await prisma.supportMessage.count({ where: { userId: user.id } });
  if (existing > 0) return NextResponse.json({ ok: true, imported: 0 });

  const raw = await req.json().catch(() => ({}));
  const list = Array.isArray(raw?.messages) ? raw.messages.slice(0, SUPPORT_MAX_IMPORT) : [];
  const now = Date.now();
  const data = list
    .map((m: any) => {
      const body = String(m?.body ?? "").trim().slice(0, SUPPORT_MAX_BODY);
      const t = new Date(String(m?.createdAt ?? ""));
      const ts = Number.isNaN(t.getTime()) || t.getTime() > now ? now : t.getTime();
      return body ? { userId: user.id, from: "user", body, createdAt: new Date(ts) } : null;
    })
    .filter(Boolean);
  if (data.length === 0) return NextResponse.json({ ok: true, imported: 0 });
  await prisma.supportMessage.createMany({ data: data as any });
  await prisma.user.update({ where: { id: user.id }, data: { supportClosed: false } });
  return NextResponse.json({ ok: true, imported: data.length });
}
