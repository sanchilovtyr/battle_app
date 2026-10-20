import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { fetchFeed, runCompetitorChecks, runSourceFetch } from "@/lib/monitorRun";
import { defaultDeps } from "@/lib/monitorStore";
import { parsePublicUrl } from "@/lib/safeFetch";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const db = prisma as any;
const requireAdmin = () => verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value);

async function state() {
  const [sources, items, competitors, changes] = await Promise.all([
    db.monitorSource.findMany({ orderBy: { createdAt: "asc" } }),
    db.monitorItem.count(),
    db.competitor.count(),
    db.competitorChange.count(),
  ]);
  return { sources, items, competitors, changes };
}

export async function GET() {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  try {
    return NextResponse.json(await state());
  } catch (e) {
    console.error("Мониторинг: не удалось прочитать данные (нужен prisma db push?)", e);
    return NextResponse.json({ sources: [], items: 0, competitors: 0, changes: 0, needsDbPush: true });
  }
}

/** action: add (name, url) | toggle (id, enabled) | remove (id) | run */
export async function POST(req: Request) {
  if (!requireAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  try {
    const deps = defaultDeps();
    if (body.action === "add") {
      const check = parsePublicUrl(body.url);
      if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });
      const url = check.url.toString();
      if (await db.monitorSource.findUnique({ where: { url }, select: { id: true } })) return NextResponse.json({ error: "Эта лента уже добавлена" }, { status: 400 });
      const total = await db.monitorSource.count();
      if (total >= 20) return NextResponse.json({ error: "Не больше 20 лент" }, { status: 400 });
      const probe = await fetchFeed(deps, url);
      if (!probe.ok) return NextResponse.json({ error: probe.error }, { status: 400 });
      const name = (typeof body.name === "string" ? body.name.trim() : "").slice(0, 80) || check.url.hostname.replace(/^www\./, "");
      const created = await db.monitorSource.create({ data: { name, url } });
      const items = probe.items.map((i) => ({ linkHash: createHash("sha256").update(i.link).digest("hex"), title: i.title, link: i.link, summary: i.summary, publishedAt: i.publishedAt }));
      await deps.store.saveItems(created.id, items);
      await deps.store.saveSourceResult(created.id, { ok: true, error: "", items: items.length, at: new Date() });
    } else if (body.action === "toggle" && typeof body.id === "string") {
      await db.monitorSource.update({ where: { id: body.id }, data: { enabled: body.enabled === true } });
    } else if (body.action === "remove" && typeof body.id === "string") {
      await db.monitorSource.delete({ where: { id: body.id } });
    } else if (body.action === "run") {
      const sources = await runSourceFetch(deps);
      const competitors = await runCompetitorChecks(deps, { limit: 15, budgetMs: 25_000 });
      return NextResponse.json({ ...(await state()), run: { sources, competitors } });
    } else {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }
    return NextResponse.json(await state());
  } catch (e) {
    console.error("Мониторинг: ошибка действия администратора", e);
    return NextResponse.json({ error: "Не удалось выполнить действие. Если вы только что обновили код, выполните npx prisma db push." }, { status: 500 });
  }
}
