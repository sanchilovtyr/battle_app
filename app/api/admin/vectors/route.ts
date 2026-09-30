import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { getEditableVectors, VectorOverrideData } from "@/lib/adminVectors";

export async function GET() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const rows = await prisma.vectorOverride.findMany();
  const overrides: Record<string, VectorOverrideData> = {};
  for (const row of rows) {
    overrides[row.vectorId] = {
      name: row.name,
      tagline: row.tagline,
      pain: row.pain,
      dream: row.dream,
      toneAdvice: row.toneAdvice,
      adTips: row.adTips as string[],
      avoid: row.avoid,
    };
  }

  const vectors = getEditableVectors(overrides);
  return NextResponse.json({ vectors });
}
