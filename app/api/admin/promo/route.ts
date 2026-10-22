import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { generateCode, parsePromoInput } from "@/lib/promoCore";

export const dynamic = "force-dynamic";

const db = prisma as any;
const isAdmin = () => verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value);

async function list() {
  return db.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, code: true, percent: true, planId: true, active: true, expiresAt: true, maxUses: true, usedCount: true, note: true, createdAt: true },
  });
}

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  try {
    return NextResponse.json({ promos: await list(), suggested: generateCode() });
  } catch (e) {
    console.error("Промокоды: не удалось прочитать (нужен prisma db push?)", e);
    return NextResponse.json({ promos: [], suggested: generateCode(), needsDbPush: true });
  }
}

/** action: create (code, percent, expiresAt?, maxUses?, note?) | toggle (id, active) | remove (id) */
export async function POST(req: Request) {
  if (!isAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  try {
    if (body.action === "create") {
      const parsed = parsePromoInput(body, new Date());
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const v = parsed.value;
      if (await db.promoCode.findUnique({ where: { code: v.code }, select: { id: true } })) {
        return NextResponse.json({ error: "Такой промокод уже есть" }, { status: 400 });
      }
      await db.promoCode.create({ data: { code: v.code, percent: v.percent, planId: v.planId, expiresAt: v.expiresAt, maxUses: v.maxUses, note: v.note } });
    } else if (body.action === "toggle" && typeof body.id === "string") {
      await db.promoCode.update({ where: { id: body.id }, data: { active: body.active === true } });
    } else if (body.action === "remove" && typeof body.id === "string") {
      const row = await db.promoCode.findUnique({ where: { id: body.id }, select: { usedCount: true } });
      if (row && row.usedCount > 0) {
        // Использованный код не удаляем, чтобы сохранить историю: его можно только выключить
        await db.promoCode.update({ where: { id: body.id }, data: { active: false } });
        return NextResponse.json({ promos: await list(), suggested: generateCode(), notice: "Код уже использовали, поэтому он выключен, а не удалён." });
      }
      await db.promoCode.delete({ where: { id: body.id } });
    } else {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }
    return NextResponse.json({ promos: await list(), suggested: generateCode() });
  } catch (e) {
    console.error("Промокоды: ошибка действия администратора", e);
    return NextResponse.json({ error: "Не удалось выполнить действие. Если вы только что обновили код, выполните npx prisma db push." }, { status: 500 });
  }
}

