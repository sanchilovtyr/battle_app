import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminGuard";
import { resolveRange } from "@/lib/analyticsCore";
import { listReplays } from "@/lib/analyticsStore";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const range = resolveRange({ days: Number(q.get("days")) || null, from: q.get("from"), to: q.get("to") }, new Date());
  try {
    return NextResponse.json({ sessions: await listReplays(range) });
  } catch (e) {
    console.error("Вебвизор: ошибка списка", e);
    return NextResponse.json({ error: "Не удалось загрузить записи. Выполните npx prisma db push." }, { status: 500 });
  }
}
