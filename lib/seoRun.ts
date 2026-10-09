import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/blog";
import { NICHES, nichePath } from "@/lib/niches";
import { getIndexNowKey, pendingPosts } from "@/lib/indexnowCore";
import {
  AuditPost,
  FetchedPage,
  RawIssue,
  auditFetchedPage,
  auditPortfolio,
  auditPostContent,
  auditRobots,
  auditAiRobots,
  auditLlms,
  auditHomeStructured,
  auditBotVisits,
  auditIndexNow,
  BotVisitInfo,
  auditSetup,
  auditSitemap,
  computeScore,
} from "@/lib/seoAudit";

const MAX_PAGES = 40;
const FETCH_TIMEOUT_MS = 10000;

interface Fetched {
  status: number;
  text: string;
  ms: number;
}

/** Загружает страницу своего же сайта. null — сеть недоступна (а не «страница вернула ошибку») */
async function fetchOwn(url: string): Promise<Fetched | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      cache: "no-store",
      headers: { "User-Agent": "KeyWordSEOMonitor/1.0" },
    });
    const text = await res.text();
    return { status: res.status, text, ms: Date.now() - started };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

export interface AuditResult {
  score: number;
  critical: number;
  warning: number;
  info: number;
  pagesChecked: number;
  networkOk: boolean;
  newIssues: number;
}

/**
 * Полный прогон: проверки текста + обход собственных страниц + синхронизация с базой.
 * Исправленные проблемы закрываются сами (resolved), вернувшиеся — открываются заново.
 */
export async function runSeoAudit(trigger: "manual" | "cron"): Promise<AuditResult> {
  const now = new Date();
  const posts = (await prisma.blogPost.findMany({
    select: {
      id: true, slug: true, title: true, excerpt: true, body: true, coverAlt: true, hasCover: true,
      metaTitle: true, metaDescription: true, keywords: true, authorName: true, indexNowAt: true, published: true, publishedAt: true,
      createdAt: true, updatedAt: true,
    },
  })) as AuditPost[];

  const lastCron = (await prisma.seoAuditRun.findFirst({
    where: { trigger: "cron" },
    orderBy: { ranAt: "desc" },
    select: { ranAt: true },
  })) as { ranAt: Date } | null;

  const found: RawIssue[] = [];
  for (const p of posts) found.push(...auditPostContent(p, now));
  found.push(...auditPortfolio(posts, now));
  // Если проверка запущена по расписанию прямо сейчас — значит, расписание работает
  found.push(...auditSetup(process.env as Record<string, string | undefined>, trigger === "cron" ? now : lastCron?.ranAt ?? null, now));

  // ── обход живых страниц ──
  const siteUrl = (process.env.SEO_CRAWL_BASE_URL || process.env.NEXTAUTH_URL || SITE_URL).replace(/\/$/, "");
  const live = posts.filter((p) => p.published && p.publishedAt && p.publishedAt <= now);
  const targets: { path: string; isPost: boolean; id: string; hasCover: boolean }[] = [
    { path: "/", isPost: false, id: "", hasCover: false },
    { path: "/blog", isPost: false, id: "", hasCover: false },
    { path: "/about", isPost: false, id: "", hasCover: false },
    ...NICHES.map((n) => ({ path: nichePath(n.slug), isPost: false, id: "", hasCover: false })),
    ...live.slice(0, MAX_PAGES - 3 - NICHES.length).map((p) => ({ path: `/blog/${p.slug}`, isPost: true, id: p.id, hasCover: p.hasCover })),
  ];

  const [robots, sitemap, llms] = await Promise.all([
    fetchOwn(`${siteUrl}/robots.txt`),
    fetchOwn(`${siteUrl}/sitemap.xml`),
    fetchOwn(`${siteUrl}/llms.txt`),
  ]);
  const pages = await mapLimit(targets, 4, async (t) => ({ t, res: await fetchOwn(siteUrl + t.path) }));

  const inKey = getIndexNowKey();
  const keyFile = inKey ? await fetchOwn(`${siteUrl}/${inKey}.txt`) : null;

  const reachable = [robots, sitemap, llms, keyFile, ...pages.map((p) => p.res)].some((r) => r !== null);
  let pagesChecked = 0;
  if (!reachable) {
    found.push({
      code: "setup.crawl-unreachable",
      severity: "info",
      category: "setup",
      title: "Монитор не смог открыть страницы сайта",
      detail: `Запросы к ${siteUrl} не прошли — проверки страниц, robots.txt и sitemap пропущены (проверки текста выполнены).`,
      fix: "Проверьте NEXTAUTH_URL (адрес сайта) или задайте SEO_CRAWL_BASE_URL — адрес, по которому сервер может достучаться до самого себя.",
      target: "",
      targetId: "",
    });
  } else {
    if (robots) {
      found.push(...auditRobots(robots.status, robots.text));
      if (robots.status === 200) found.push(...auditAiRobots(robots.text));
    }
    if (llms) found.push(...auditLlms(llms.status, llms.text));
    if (sitemap) found.push(...auditSitemap(sitemap.status, sitemap.text, live.map((p) => ({ slug: p.slug, id: p.id }))));
    for (const { t, res } of pages) {
      if (!res) continue;
      pagesChecked++;
      const page: FetchedPage = {
        path: t.path, status: res.status, ms: res.ms, html: res.text,
        isPost: t.isPost, targetId: t.id, hasCover: t.hasCover,
      };
      found.push(...auditFetchedPage(page, siteUrl));
      if (t.path === "/" && res.status === 200) found.push(...auditHomeStructured(res.text));
    }
  }

  // ── IndexNow: работает ли уведомление Яндекса о новых страницах ──
  try {
    const lastPing = (await prisma.indexNowPing.findFirst({ orderBy: { createdAt: "desc" } })) as { createdAt: Date; yandex: number } | null;
    const pend = pendingPosts(
      posts.map((p) => ({ id: p.id, slug: p.slug, published: p.published, publishedAt: p.publishedAt, updatedAt: p.updatedAt, indexNowAt: p.indexNowAt ?? null })),
      now
    );
    found.push(
      ...auditIndexNow(
        {
          key: inKey,
          keyFile: keyFile ? { status: keyFile.status, text: keyFile.text } : null,
          lastPing,
          pendingSince: pend.length ? new Date(Math.min(...pend.map((p) => p.updatedAt.getTime()))) : null,
        },
        now
      )
    );
  } catch (e) {
    console.error("SEO-монитор: IndexNow недоступен (нужен prisma db push?)", e);
  }

  // ── визиты роботов (если таблицы ещё нет — пропускаем, чтобы не плодить ложные тревоги) ──
  try {
    const visits = (await prisma.botVisit.findMany()) as (BotVisitInfo & { firstSeenAt: Date })[];
    const firstRun = (await prisma.seoAuditRun.findFirst({ orderBy: { ranAt: "asc" }, select: { ranAt: true } })) as { ranAt: Date } | null;
    const starts = [...visits.map((v) => v.firstSeenAt), ...(firstRun ? [firstRun.ranAt] : [])];
    const trackingSince = starts.length ? new Date(Math.min(...starts.map((d) => d.getTime()))) : now;
    found.push(...auditBotVisits(visits, trackingSince, now));
  } catch (e) {
    console.error("SEO-монитор: визиты роботов недоступны (нужен prisma db push?)", e);
  }

  // ── синхронизация с базой ──
  const keyOf = (i: RawIssue) => `${i.code}:${i.target || "-"}`;
  const existing = (await prisma.seoIssue.findMany()) as {
    id: string; key: string; status: string; snoozedUntil: Date | null;
  }[];
  const byKey = new Map(existing.map((e) => [e.key, e]));
  const seen = new Set<string>();
  let newIssues = 0;

  for (const i of found) {
    const key = keyOf(i);
    if (seen.has(key)) continue;
    seen.add(key);
    const fields = {
      code: i.code, severity: i.severity, category: i.category, title: i.title,
      detail: i.detail, fix: i.fix, target: i.target, targetId: i.targetId, lastSeenAt: now,
    };
    const prev = byKey.get(key);
    if (!prev) {
      await prisma.seoIssue.create({ data: { key, ...fields } });
      newIssues++;
    } else if (prev.status === "resolved") {
      // Проблема вернулась — открываем заново и снова сообщаем
      await prisma.seoIssue.update({
        where: { id: prev.id },
        data: { ...fields, status: "open", resolvedAt: null, snoozedUntil: null, notifiedAt: null },
      });
      newIssues++;
    } else if (prev.status === "snoozed" && (!prev.snoozedUntil || prev.snoozedUntil <= now)) {
      await prisma.seoIssue.update({ where: { id: prev.id }, data: { ...fields, status: "open", snoozedUntil: null } });
    } else {
      await prisma.seoIssue.update({ where: { id: prev.id }, data: fields });
    }
  }
  for (const e of existing) {
    if (e.status !== "resolved" && !seen.has(e.key)) {
      await prisma.seoIssue.update({ where: { id: e.id }, data: { status: "resolved", resolvedAt: now } });
    }
  }

  // Оценка считается по тому, что реально требует внимания (без отложенных и игнорируемых)
  const active = found.filter((i, idx) => found.findIndex((j) => keyOf(j) === keyOf(i)) === idx);
  const muted = new Set(
    ((await prisma.seoIssue.findMany({ where: { status: { in: ["snoozed", "ignored"] } }, select: { key: true } })) as { key: string }[]).map((m) => m.key)
  );
  const counted = active.filter((i) => !muted.has(keyOf(i)));
  const count = (s: string) => counted.filter((i) => i.severity === s).length;
  const result: AuditResult = {
    score: computeScore(counted),
    critical: count("critical"),
    warning: count("warning"),
    info: count("info"),
    pagesChecked,
    networkOk: reachable,
    newIssues,
  };

  await prisma.seoAuditRun.create({
    data: {
      trigger, score: result.score, critical: result.critical, warning: result.warning,
      info: result.info, pagesChecked, networkOk: reachable,
    },
  });
  return result;
}

/** Письмо о новых серьёзных проблемах. Каждая проблема упоминается один раз (notifiedAt) */
export async function sendSeoDigest(): Promise<{ sent: boolean; count: number }> {
  const to = process.env.ADMIN_NOTIFY_EMAIL;
  if (!to) return { sent: false, count: 0 };

  const fresh = (await prisma.seoIssue.findMany({
    where: { status: "open", notifiedAt: null, severity: { in: ["critical", "warning"] } },
    orderBy: { firstSeenAt: "asc" },
    select: { id: true, severity: true, title: true, fix: true },
  })) as { id: string; severity: string; title: string; fix: string }[];
  if (fresh.length === 0) return { sent: false, count: 0 };

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const site = (process.env.NEXTAUTH_URL || SITE_URL).replace(/\/$/, "");
  const rows = fresh
    .map(
      (i) =>
        `<li style="margin-bottom:10px"><b style="color:${i.severity === "critical" ? "#c0392b" : "#b9770e"}">${
          i.severity === "critical" ? "Срочно" : "Нужно исправить"
        }:</b> ${esc(i.title)}<br/><span style="color:#70758A">Что сделать: ${esc(i.fix)}</span></li>`
    )
    .join("");

  const { sendMail } = await import("@/lib/mailer");
  await sendMail({
    to,
    subject: `SEO-монитор: ${fresh.length} ${fresh.length === 1 ? "новая задача" : "новых задач"} для сайта`,
    html: `<div style="font-family:sans-serif;max-width:560px;color:#111525"><h2>SEO-монитор нашёл, что нужно сделать</h2><ul style="padding-left:18px">${rows}</ul><p><a href="${site}/admin">Открыть админ-панель → SEO-монитор</a></p></div>`,
  });
  for (const i of fresh) {
    await prisma.seoIssue.update({ where: { id: i.id }, data: { notifiedAt: new Date() } });
  }
  return { sent: true, count: fresh.length };
}

