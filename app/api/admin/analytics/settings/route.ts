import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminGuard";
import { getSettings, saveSettings } from "@/lib/analyticsStore";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  return NextResponse.json(await getSettings(true));
}

export async function PUT(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  try {
    return NextResponse.json(await saveSettings({ replayEnabled: body.replayEnabled !== false, replayPercent: Number(body.replayPercent) || 100 }));
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить. Выполнили ли вы npx prisma db push?" }, { status: 500 });
  }
}
