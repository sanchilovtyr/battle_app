import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Все бизнесы пользователя со всеми внесёнными данными — для входа с любого браузера. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const rows = await prisma.business.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    businesses: rows.map((b: any) => ({
      id: b.id,
      name: b.name,
      businessType: b.businessType,
      createdAt: b.createdAt,
      plan: b.planJson,
      vectorId: b.vectorId ?? undefined,
      checklist: b.checklistJson ?? {},
      funnel: b.funnelJson ?? [],
      progress: b.progressJson ?? [],
      target: b.targetJson ?? {},
    })),
  });
}
