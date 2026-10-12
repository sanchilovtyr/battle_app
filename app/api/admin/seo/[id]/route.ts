import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Управление статусом замечания: отложить на неделю, игнорировать, вернуть в работу */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  const data =
    action === "snooze"
      ? { status: "snoozed", snoozedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
      : action === "ignore"
      ? { status: "ignored", snoozedUntil: null }
      : action === "reopen"
      ? { status: "open", snoozedUntil: null }
      : null;
  if (!data) return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });

  try {
    await prisma.seoIssue.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Замечание не найдено" }, { status: 404 });
  }
}
