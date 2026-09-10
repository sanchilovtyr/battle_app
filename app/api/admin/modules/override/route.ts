import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { MODULES } from "@/lib/modules";

function requireAdmin(): boolean {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

export async function POST(req: Request) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const moduleId = String(body?.moduleId ?? "");
  if (!MODULES.some((m) => m.id === moduleId)) {
    return NextResponse.json({ error: "Неизвестный модуль" }, { status: 400 });
  }

  const title = String(body?.title ?? "").slice(0, 300);
  const why = String(body?.why ?? "").slice(0, 3000);
  const timeToResult = String(body?.timeToResult ?? "").slice(0, 200);
  const steps = Array.isArray(body?.steps)
    ? body.steps.map((s: unknown) => String(s).slice(0, 2000)).slice(0, 20)
    : [];

  await prisma.moduleOverride.upsert({
    where: { moduleId },
    create: { moduleId, title, why, timeToResult, steps },
    update: { title, why, timeToResult, steps },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get("moduleId");
  if (!moduleId) return NextResponse.json({ error: "Не указан moduleId" }, { status: 400 });

  await prisma.moduleOverride.deleteMany({ where: { moduleId } });
  return NextResponse.json({ ok: true });
}
