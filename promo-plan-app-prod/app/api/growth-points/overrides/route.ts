import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { GrowthPointOverrideData } from "@/lib/adminGrowthPoints";

/** Публичный эндпоинт — читает пользователь при показе точек роста
 *  (components/GrowthPoints.tsx), не только админ */
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
