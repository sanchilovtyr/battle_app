import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { getEditableBaseModules, ModuleOverride } from "@/lib/adminModules";

export async function GET() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const [overrideRows, customModules] = await Promise.all([
    prisma.moduleOverride.findMany(),
    prisma.customModule.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const overrides: Record<string, ModuleOverride> = {};
  for (const row of overrideRows) {
    overrides[row.moduleId] = {
      title: row.title,
      why: row.why,
      timeToResult: row.timeToResult,
      steps: row.steps as string[],
    };
  }

  const baseModules = getEditableBaseModules(overrides).map((m) => ({
    id: m.id,
    title: m.title,
    phase: m.phase,
    timeToResult: m.timeToResult,
    why: m.why({} as never),
    steps: m.steps,
    isOverridden: m.isOverridden,
  }));

  return NextResponse.json({ baseModules, customModules });
}
