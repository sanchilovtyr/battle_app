import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { isKnownGrowthPointId } from "@/lib/adminGrowthPoints";

function requireAdmin(): boolean {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

export async function POST(req: Request) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const pointId = String(body?.pointId ?? "");
  if (!isKnownGrowthPointId(pointId)) {
    return NextResponse.json({ error: "Неизвестная точка роста" }, { status: 400 });
  }

  const title = String(body?.title ?? "").slice(0, 300);
  const bodyText = String(body?.body ?? "").slice(0, 2000);
  const action = String(body?.action ?? "").slice(0, 500);

  await prisma.growthPointOverride.upsert({
    where: { pointId },
    create: { pointId, title, body: bodyText, action },
    update: { title, body: bodyText, action },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pointId = searchParams.get("pointId");
  if (!pointId) return NextResponse.json({ error: "Не указан pointId" }, { status: 400 });

  await prisma.growthPointOverride.deleteMany({ where: { pointId } });
  return NextResponse.json({ ok: true });
}
