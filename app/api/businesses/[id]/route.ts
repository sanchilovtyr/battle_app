import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import {
  MAX_BODY_BYTES,
  MAX_BUSINESSES_PER_USER,
  isValidBusinessId,
  sanitizePatch,
  sanitizePlan,
} from "@/lib/businessSync";

export const dynamic = "force-dynamic";

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function toData(patch: ReturnType<typeof sanitizePatch>) {
  return {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.businessType !== undefined ? { businessType: patch.businessType } : {}),
    ...(patch.vectorId !== undefined ? { vectorId: patch.vectorId } : {}),
    ...(patch.checklist !== undefined ? { checklistJson: patch.checklist } : {}),
    ...(patch.funnel !== undefined ? { funnelJson: patch.funnel } : {}),
    ...(patch.progress !== undefined ? { progressJson: patch.progress } : {}),
    ...(patch.target !== undefined ? { targetJson: patch.target } : {}),
  };
}

/** Создать бизнес или обновить целиком (создание нового плана и перенос данных из браузера). */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  if (!isValidBusinessId(params.id)) return NextResponse.json({ error: "Некорректный id" }, { status: 400 });

  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "Некорректный или слишком большой запрос" }, { status: 400 });

  const existing = await prisma.business.findUnique({ where: { id: params.id } });
  if (existing && existing.userId !== user.id) {
    // id занят чужим бизнесом — крайне маловероятно; клиент не затирает чужое
    return NextResponse.json({ error: "Конфликт идентификатора" }, { status: 409 });
  }

  const plan = sanitizePlan(body.plan);
  if (!existing && !plan) return NextResponse.json({ error: "Некорректный план" }, { status: 400 });

  if (!existing) {
    const count = await prisma.business.count({ where: { userId: user.id } });
    if (count >= MAX_BUSINESSES_PER_USER) {
      return NextResponse.json({ error: "Слишком много бизнесов в аккаунте" }, { status: 400 });
    }
  }

  const patch = sanitizePatch(body);
  const createdAtRaw = typeof body.createdAt === "string" ? new Date(body.createdAt) : null;
  const createdAt = createdAtRaw && !isNaN(createdAtRaw.getTime()) ? createdAtRaw : new Date();

  if (existing) {
    await prisma.business.update({
      where: { id: params.id },
      data: { ...toData(patch), ...(plan ? { planJson: plan as any } : {}) },
    });
  } else {
    await prisma.business.create({
      data: {
        id: params.id,
        userId: user.id,
        name: patch.name ?? "Мой бизнес",
        businessType: patch.businessType ?? "",
        planJson: plan as any,
        createdAt,
        ...toData(patch),
      },
    });
  }
  return NextResponse.json({ ok: true });
}

/** Обновить отдельные поля: чек-лист, показатели, историю, цель, вектор. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  if (!isValidBusinessId(params.id)) return NextResponse.json({ error: "Некорректный id" }, { status: 400 });

  const body = await readBody(req);
  if (!body) return NextResponse.json({ error: "Некорректный или слишком большой запрос" }, { status: 400 });

  const result = await prisma.business.updateMany({
    where: { id: params.id, userId: user.id },
    data: toData(sanitizePatch(body)),
  });
  if (result.count === 0) return NextResponse.json({ error: "Бизнес не найден" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  if (!isValidBusinessId(params.id)) return NextResponse.json({ error: "Некорректный id" }, { status: 400 });

  await prisma.business.deleteMany({ where: { id: params.id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
