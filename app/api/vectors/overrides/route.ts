import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { VectorOverrideData } from "@/lib/adminVectors";

/** Публичный эндпоинт — читает пользователь при показе своего вектора
 *  аудитории (VectorResultCard), не только админ */
export async function GET() {
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
  return NextResponse.json({ overrides });
}
