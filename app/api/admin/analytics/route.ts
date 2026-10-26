import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { loadReport } from "@/lib/analyticsStore";
import { resolveRange } from "@/lib/analyticsCore";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const q = new URL(req.url).searchParams;
  const range = resolveRange({ days: Number(q.get("days")) || null, from: q.get("from"), to: q.get("to") }, new Date());
  try {
    return NextResponse.json(await loadReport(range));
  } catch (e) {
    console.error("Аналитика: ошибка отчёта", e);
    return NextResponse.json(
      { error: "Не удалось построить отчёт. Если вы только что обновили сайт, выполните npx prisma db push." },
      { status: 500 }
    );
  }
}
