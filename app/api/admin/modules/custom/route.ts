import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

const PHASES = ["foundation", "traffic", "retention"];

function requireAdmin(): boolean {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

export async function POST(req: Request) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" && body.id ? body.id : undefined;
  const phase = String(body?.phase ?? "");
  if (!PHASES.includes(phase)) {
    return NextResponse.json({ error: "Некорректный этап" }, { status: 400 });
  }

  const title = String(body?.title ?? "").slice(0, 300);
  const why = String(body?.why ?? "").slice(0, 3000);
  const timeToResult = String(body?.timeToResult ?? "").slice(0, 200);
  const steps = Array.isArray(body?.steps)
    ? body.steps.map((s: unknown) => String(s).slice(0, 2000)).slice(0, 20)
    : [];
  const score = Math.min(10, Math.max(1, Number(body?.score) || 1));
  const businessTypes = Array.isArray(body?.businessTypes)
    ? body.businessTypes.map((s: unknown) => String(s)).slice(0, 10)
    : [];

  const data = { title, phase, timeToResult, why, steps, score, businessTypes };

  const saved = id
    ? await prisma.customModule.update({ where: { id }, data })
    : await prisma.customModule.create({ data });

  return NextResponse.json({ ok: true, module: saved });
}

export async function DELETE(req: Request) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указан id" }, { status: 400 });

  try {
    await prisma.customModule.delete({ where: { id } });
  } catch (e) {
    console.error("Не удалось удалить кастомный модуль", e);
  }

  return NextResponse.json({ ok: true });
}
