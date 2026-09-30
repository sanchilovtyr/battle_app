import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const businessId = String(body?.businessId ?? "");
  if (!businessId) {
    return NextResponse.json({ error: "Не указан businessId" }, { status: 400 });
  }

  await prisma.metrikaConnection
    .delete({ where: { userId_businessId: { userId: user.id, businessId } } })
    .catch(() => null); // уже отключено — тоже нормальный исход

  return NextResponse.json({ ok: true });
}
