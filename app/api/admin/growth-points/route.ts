import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { GROWTH_POINT_CATALOG, GrowthPointOverrideData } from "@/lib/adminGrowthPoints";

export async function GET() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const rows = await prisma.growthPointOverride.findMany();
  const overrides: Record<string, GrowthPointOverrideData> = {};
  for (const row of rows) {
    overrides[row.pointId] = { title: row.title, body: row.body, action: row.action || undefined };
  }

  const points = GROWTH_POINT_CATALOG.map((entry) => {
    const o = overrides[entry.id];
    return {
      id: entry.id,
      title: o?.title ?? entry.defaultTitle,
      body: o?.body ?? entry.defaultBody,
      action: o?.action ?? entry.defaultAction ?? "",
      note: entry.note,
      isOverridden: Boolean(o),
    };
  });

  return NextResponse.json({ points });
}
