import { NextResponse } from "next/server";
import { requireRisksUser } from "@/lib/riskAccess";
import { libraryForBusiness } from "@/lib/riskLibrary";
import { loadLibrary } from "@/lib/riskLibraryStore";

export const dynamic = "force-dynamic";

/** Типовые угрозы для типа бизнеса с правками администратора. Пользователь их только читает. */
export async function GET(req: Request) {
  const auth = await requireRisksUser();
  if ("error" in auth) return auth.error;
  try {
    const type = new URL(req.url).searchParams.get("businessType");
    return NextResponse.json({ templates: libraryForBusiness(await loadLibrary(), type) });
  } catch (e) {
    console.error("Библиотека угроз: не удалось прочитать (нужен prisma db push?)", e);
    // null — страница использует встроенный список
    return NextResponse.json({ templates: null });
  }
}
