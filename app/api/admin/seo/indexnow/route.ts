import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { pingPendingPosts } from "@/lib/indexnow";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Кнопка в админке: сообщить Яндексу и Bing о новых/изменённых статьях (all — обо всех опубликованных) */
export async function POST(req: Request) {
  if (!verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { all?: boolean };
  const result = await pingPendingPosts("manual", { all: Boolean(body.all) });
  return NextResponse.json({ ok: true, result });
}
