import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { VectorOverrideData } from "@/lib/adminVectors";

/** Публичный эндпоинт — читает пользователь при показе своего вектора
 *  аудитории (VectorResultCard), не только админ.
 *  force-dynamic — чтобы Next.js не пытался выполнить и статически
 *  экспортировать этот роут во время сборки (там ещё может не быть
 *  таблицы VectorOverride до `prisma db push`). */
export const dynamic = "force-dynamic";

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
