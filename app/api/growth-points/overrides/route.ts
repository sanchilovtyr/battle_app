import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { GrowthPointOverrideData } from "@/lib/adminGrowthPoints";

/** Публичный эндпоинт — читает пользователь при показе точек роста
 *  (components/GrowthPoints.tsx), не только админ.
 *  force-dynamic — чтобы Next.js не пытался выполнить и статически
 *  экспортировать этот роут во время сборки (там ещё может не быть
 *  таблицы GrowthPointOverride до `prisma db push`). */
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.growthPointOverride.findMany();
  const overrides: Record<string, GrowthPointOverrideData> = {};
  for (const row of rows) {
    overrides[row.pointId] = {
      title: row.title,
      body: row.body,
      action: row.action || undefined,
    };
  }
  return NextResponse.json({ overrides });
}
