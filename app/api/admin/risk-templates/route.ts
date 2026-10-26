import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { BUSINESS_TYPE_LABELS } from "@/lib/businessTypes";
import { MAX_CUSTOM_TEMPLATES, builtinEntries, parseTemplateInput } from "@/lib/riskLibrary";
import { loadLibrary, rtDb } from "@/lib/riskLibraryStore";

export const dynamic = "force-dynamic";

const isAdmin = () => verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value);
const state = async () => ({ templates: await loadLibrary(), typeLabels: BUSINESS_TYPE_LABELS });

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  try {
    return NextResponse.json(await state());
  } catch (e) {
    console.error("Библиотека угроз: не удалось прочитать (нужен prisma db push?)", e);
    const { mergeLibrary } = await import("@/lib/riskLibrary");
    return NextResponse.json({ templates: mergeLibrary([]), typeLabels: BUSINESS_TYPE_LABELS, needsDbPush: true });
  }
}

/** action: save (id?, поля) | hide (id, hidden) | reset (id встроенной) | remove (id своей) */
export async function POST(req: Request) {
  if (!isAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const builtinIds = new Set(builtinEntries().map((b) => b.id));
  const id = typeof body.id === "string" ? body.id : "";
  try {
    if (body.action === "save") {
      const parsed = parseTemplateInput(body);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const v = parsed.value;
      if (id && builtinIds.has(id)) {
        // Правка встроенной записи: группы типов бизнеса у встроенных не меняются
        const { types: _types, ...rest } = v;
        await rtDb.riskTemplateRow.upsert({ where: { id }, create: { id, builtin: true, ...rest, types: [] }, update: { ...rest } });
      } else if (id.startsWith("c-")) {
        await rtDb.riskTemplateRow.update({ where: { id }, data: { ...v } });
      } else if (!id) {
        if ((await rtDb.riskTemplateRow.count({ where: { builtin: false } })) >= MAX_CUSTOM_TEMPLATES) {
          return NextResponse.json({ error: `Не больше ${MAX_CUSTOM_TEMPLATES} своих угроз` }, { status: 400 });
        }
        await rtDb.riskTemplateRow.create({ data: { id: `c-${randomBytes(6).toString("hex")}`, builtin: false, ...v } });
      } else {
        return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
      }
    } else if (body.action === "hide" && id) {
      const hidden = body.hidden === true;
      if (builtinIds.has(id)) {
        await rtDb.riskTemplateRow.upsert({ where: { id }, create: { id, builtin: true, hidden, title: "" }, update: { hidden } });
      } else if (id.startsWith("c-")) {
        await rtDb.riskTemplateRow.update({ where: { id }, data: { hidden } });
      } else return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
    } else if (body.action === "reset" && builtinIds.has(id)) {
      // Возвращает встроенный текст; скрытие при этом сохраняется
      const row = await rtDb.riskTemplateRow.findUnique({ where: { id } });
      if (row?.hidden) await rtDb.riskTemplateRow.update({ where: { id }, data: { title: "", what: "", signal: "", measures: "", plan: "", keywords: "" } });
      else if (row) await rtDb.riskTemplateRow.delete({ where: { id } });
    } else if (body.action === "remove" && id.startsWith("c-")) {
      await rtDb.riskTemplateRow.delete({ where: { id } });
    } else {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }
    return NextResponse.json(await state());
  } catch (e) {
    console.error("Библиотека угроз: ошибка действия администратора", e);
    return NextResponse.json({ error: "Не удалось выполнить действие. Если вы только что обновили код, выполните npx prisma db push." }, { status: 500 });
  }
}
