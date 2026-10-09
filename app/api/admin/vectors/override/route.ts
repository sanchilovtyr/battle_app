import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { isVectorId } from "@/lib/adminVectors";

function requireAdmin(): boolean {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

export async function POST(req: Request) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const vectorId = String(body?.vectorId ?? "");
  if (!isVectorId(vectorId)) {
    return NextResponse.json({ error: "Неизвестный вектор" }, { status: 400 });
  }

  const name = String(body?.name ?? "").slice(0, 100);
  const tagline = String(body?.tagline ?? "").slice(0, 300);
  const pain = String(body?.pain ?? "").slice(0, 1000);
  const dream = String(body?.dream ?? "").slice(0, 1000);
  const toneAdvice = String(body?.toneAdvice ?? "").slice(0, 500);
  const adTips = Array.isArray(body?.adTips)
    ? body.adTips.map((s: unknown) => String(s).slice(0, 300)).slice(0, 10)
    : [];
  const avoid = String(body?.avoid ?? "").slice(0, 1000);

  await prisma.vectorOverride.upsert({
    where: { vectorId },
    create: { vectorId, name, tagline, pain, dream, toneAdvice, adTips, avoid },
    update: { name, tagline, pain, dream, toneAdvice, adTips, avoid },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const vectorId = searchParams.get("vectorId");
  if (!vectorId) return NextResponse.json({ error: "Не указан vectorId" }, { status: 400 });

  await prisma.vectorOverride.deleteMany({ where: { vectorId } });
  return NextResponse.json({ ok: true });
}
