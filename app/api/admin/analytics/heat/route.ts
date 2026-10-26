import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminGuard";
import { normalizePath, validDevice } from "@/lib/analyticsCore";
import { listHeatPages, loadHeat } from "@/lib/analyticsStore";

export const dynamic = "force-dynamic";

/** Без параметров — список страниц с данными; с ?path=&device= — данные карт для одной страницы */
export async function GET(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const q = new URL(req.url).searchParams;
  try {
    const path = q.get("path");
    if (!path) return NextResponse.json({ pages: await listHeatPages() });
    const p = normalizePath(path);
    const device = q.get("device");
    if (!p || !validDevice(device)) return NextResponse.json({ error: "Некорректная страница или устройство" }, { status: 400 });
    return NextResponse.json(await loadHeat(p, device));
  } catch (e) {
    console.error("Карты: ошибка чтения", e);
    return NextResponse.json({ error: "Не удалось загрузить данные. Выполните npx prisma db push." }, { status: 500 });
  }
}
