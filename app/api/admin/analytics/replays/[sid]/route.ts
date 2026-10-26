import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminGuard";
import { validId } from "@/lib/analyticsCore";
import { loadReplayEvents } from "@/lib/analyticsStore";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { sid: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  if (!validId(params.sid)) return NextResponse.json({ error: "Некорректный номер сессии" }, { status: 400 });
  try {
    return NextResponse.json({ events: await loadReplayEvents(params.sid) });
  } catch (e) {
    console.error("Вебвизор: ошибка чтения записи", e);
    return NextResponse.json({ error: "Не удалось прочитать запись" }, { status: 500 });
  }
}
