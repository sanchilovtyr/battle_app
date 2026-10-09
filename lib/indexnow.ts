import { prisma } from "@/lib/db";
import { publishedWhere } from "@/lib/blog";
import {
  SubmitResult,
  getIndexNowKey,
  isAccepted,
  normalizeUrls,
  pendingPosts,
  PendingPost,
  submitToIndexNow,
} from "@/lib/indexnowCore";

export interface PingOutcome {
  sent: number;
  yandex: number;
  bing: number;
  error: string;
  skipped?: "no-key" | "nothing";
}

/** Отправляет адреса и записывает результат в журнал. Никогда не бросает исключение: публикация статьи важнее */
export async function pingUrls(paths: string[], trigger: "publish" | "cron" | "manual"): Promise<PingOutcome & { ok: boolean }> {
  const key = getIndexNowKey();
  if (!key) return { sent: 0, yandex: 0, bing: 0, error: "", skipped: "no-key", ok: false };
  const urls = normalizeUrls(paths);
  if (urls.length === 0) return { sent: 0, yandex: 0, bing: 0, error: "", skipped: "nothing", ok: false };

  let res: SubmitResult;
  try {
    res = await submitToIndexNow(key, urls);
  } catch (e) {
    res = { yandex: 0, bing: 0, error: e instanceof Error ? e.message : "ошибка" };
  }
  try {
    await prisma.indexNowPing.create({
      data: { trigger, urlCount: urls.length, urls: urls.slice(0, 20), yandex: res.yandex, bing: res.bing, error: res.error.slice(0, 300) },
    });
  } catch (e) {
    console.error("IndexNow: не удалось записать журнал (нужен prisma db push?)", e);
  }
  return { sent: urls.length, yandex: res.yandex, bing: res.bing, error: res.error, ok: isAccepted(res.yandex) };
}

/** Находит опубликованные и ещё не отправленные (или изменённые) статьи и сообщает о них. all — отправить все опубликованные */
export async function pingPendingPosts(trigger: "publish" | "cron" | "manual", opts: { all?: boolean } = {}): Promise<PingOutcome> {
  try {
    const now = new Date();
    const live = (await prisma.blogPost.findMany({
      where: publishedWhere(),
      select: { id: true, slug: true, published: true, publishedAt: true, updatedAt: true, indexNowAt: true },
      orderBy: { publishedAt: "desc" },
      take: 200,
    })) as PendingPost[];
    const todo = opts.all ? live : pendingPosts(live, now);
    if (todo.length === 0) return { sent: 0, yandex: 0, bing: 0, error: "", skipped: "nothing" };

    const out = await pingUrls(["/blog", ...todo.map((p) => `/blog/${p.slug}`)], trigger);
    if (out.ok) {
      for (const p of todo) {
        await prisma.blogPost.update({ where: { id: p.id }, data: { indexNowAt: new Date() } });
      }
    }
    return out;
  } catch (e) {
    console.error("IndexNow: ошибка отправки", e);
    return { sent: 0, yandex: 0, bing: 0, error: "внутренняя ошибка" };
  }
}

/** Сводка для админки */
export async function indexNowStatus() {
  const key = getIndexNowKey();
  let pings: unknown[] = [];
  let pending = 0;
  let tableMissing = false;
  try {
    pings = await prisma.indexNowPing.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
    const live = (await prisma.blogPost.findMany({
      where: publishedWhere(),
      select: { id: true, slug: true, published: true, publishedAt: true, updatedAt: true, indexNowAt: true },
      take: 200,
    })) as PendingPost[];
    pending = pendingPosts(live, new Date()).length;
  } catch {
    tableMissing = true;
  }
  return { hasKey: Boolean(key), keyUrl: key ? `/${key}.txt` : null, pings, pending, tableMissing };
}
