import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminGuard";
import { checkRateLimit } from "@/lib/rateLimit";
import { addTargets, collectPositions, loadPositionsView, removeTarget, updateTargetNote } from "@/lib/positions";

export const dynamic = "force-dynamic";

const NO_TABLES = "Таблицы позиций ещё не созданы: выполните npx prisma db push и обновите страницу.";

/** Отслеживаемые запросы с позициями в Яндексе и Google, динамикой и остальными запросами сайта */
export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  try {
    return NextResponse.json(await loadPositionsView());
  } catch (e) {
    console.error("Позиции: не удалось загрузить", (e as Error)?.message);
    return NextResponse.json({ error: NO_TABLES }, { status: 500 });
  }
}

/** Тело: { action: "add", text } | { action: "remove", id } | { action: "note", id, note } | { action: "refresh" } */
export async function POST(req: Request) {
  if (!isAdminRequest()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try {
    if (b?.action === "add") {
      const res = await addTargets(b.text);
      return NextResponse.json({ ok: true, ...res });
    }
    if (b?.action === "remove") {
      await removeTarget(b.id);
      return NextResponse.json({ ok: true });
    }
    if (b?.action === "note") {
      await updateTargetNote(b.id, b.note);
      return NextResponse.json({ ok: true });
    }
    if (b?.action === "refresh") {
      if (!checkRateLimit("positions-refresh", 6, 10 * 60_000)) {
        return NextResponse.json({ error: "Слишком часто. Данные в Вебмастере и Search Console обновляются раз в сутки — повторите позже." }, { status: 429 });
      }
      return NextResponse.json({ ok: true, results: await collectPositions() });
    }
  } catch (e) {
    console.error("Позиции: ошибка", (e as Error)?.message);
    return NextResponse.json({ error: NO_TABLES }, { status: 500 });
  }
  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
}
