import { prisma } from "@/lib/db";
import { KEY_NAMES, getKey } from "@/lib/integrationKeys";
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
import {
  PageDetails,
  auditBrokenLinks,
  auditDuplicates,
  auditPageDeep,
  auditSiteTech,
  collectInternalLinks,
  extractDetails,
} from "@/lib/seoPageChecks";
import { auditPsi, fetchPsi, PsiResult } from "@/lib/pageSpeed";
import { fetchYandexReport } from "@/lib/searchEngines";
import { saveMetric } from "@/lib/seoMetrics";

const MAX_PAGES = 40;
const FETCH_TIMEOUT_MS = 10000;

interface Fetched {
  status: number;
  text: string;
  ms: number;
  /** время до получения заголовков ответа, мс */
  ttfb: number;
  finalUrl: string;
  contentType: string;
  xRobotsTag: string;
  bytes: number;
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
    const ttfb = Date.now() - started;
    const text = await res.text();
    return {
      status: res.status,
      text,
      ms: Date.now() - started,
      ttfb,
      finalUrl: res.url || url,
      contentType: res.headers.get("content-type") ?? "",
      xRobotsTag: res.headers.get("x-robots-tag") ?? "",
      bytes: Buffer.byteLength(text),
    };
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

/** Один запрос без перехода по редиректам: нужен, чтобы проверить сам редирект (www, http) */
async function fetchManual(url: string): Promise<{ status: number; location: string } | null> {
  try {
    const res = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "KeyWordSEOMonitor/1.0" } });
    return { status: res.status, location: res.headers.get("location") ?? "" };
  } catch {
    return null;
  }
}

/** Срок действия SSL-сертификата сайта (читаем даже у недействительного — причину возвращаем отдельно) */
async function fetchSsl(host: string): Promise<{ expiresAt: Date | null; error: string } | null> {
  try {
    const tls = await import("tls");
    return await new Promise((resolve) => {
      const sock = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 8000 }, () => {
        const cert = sock.getPeerCertificate();
        const expiresAt = cert && cert.valid_to ? new Date(cert.valid_to) : null;
        const error = sock.authorized ? "" : String(sock.authorizationError || "сертификат не прошёл проверку");
        sock.end();
        resolve({ expiresAt: expiresAt && !isNaN(expiresAt.getTime()) ? expiresAt : null, error });
      });
      sock.on("error", () => resolve(null));
      sock.on("timeout", () => { sock.destroy(); resolve(null); });
    });
  } catch {
    return null;
  }
}

/** Статус внутренней ссылки: сначала HEAD, при отказе — GET. null — не удалось проверить */
async function linkStatus(url: string): Promise<number | null> {
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(url, { method, redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(7000), headers: { "User-Agent": "KeyWordSEOMonitor/1.0" } });
      if (method === "HEAD" && (res.status === 405 || res.status === 501)) continue;
      return res.status;
    } catch {
      /* пробуем следующий способ */
    }
  }
  return null;
}

const withDeadline = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

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
  const baseSelect = {
    id: true, slug: true, title: true, excerpt: true, body: true, coverAlt: true, hasCover: true,
    metaTitle: true, metaDescription: true, keywords: true, published: true, publishedAt: true,
    createdAt: true, updatedAt: true,
  } as const;
  let posts: AuditPost[];
  try {
    posts = (await prisma.blogPost.findMany({
      select: { ...baseSelect, authorName: true, indexNowAt: true },
    })) as AuditPost[];
  } catch (e) {
    // В базе может не быть новых колонок (автор, IndexNow) — читаем без них, остальные проверки работают
    console.error("SEO-монитор: колонки автора/IndexNow недоступны, читаю статьи без них", e);
    posts = ((await prisma.blogPost.findMany({ select: baseSelect })) as unknown as AuditPost[]).map((p) => ({
      ...p,
      authorName: "",
      indexNowAt: null,
    }));
  }

  const lastCron = (await prisma.seoAuditRun
    .findFirst({ where: { trigger: "cron" }, orderBy: { ranAt: "desc" }, select: { ranAt: true } })
    .catch(() => null)) as { ranAt: Date } | null;

  const found: RawIssue[] = [];
  for (const p of posts) found.push(...auditPostContent(p, now));
  found.push(...auditPortfolio(posts, now));
  // Если проверка запущена по расписанию прямо сейчас — значит, расписание работает
  // Ключи Яндекс Вебмастера и Google Search Console могут быть введены в админке (таблица IntegrationKey),
  // а не только в переменных окружения — иначе проверка ошибочно считает их не заданными.
  const env: Record<string, string | undefined> = { ...(process.env as Record<string, string | undefined>) };
  for (const name of KEY_NAMES) {
    const { value } = await getKey(name).catch(() => ({ value: "" }));
    if (value) env[name] = value;
  }
  found.push(...auditSetup(env, trigger === "cron" ? now : lastCron?.ranAt ?? null, now));

  // ── обход живых страниц ──
  const siteUrl = (process.env.SEO_CRAWL_BASE_URL || process.env.NEXTAUTH_URL || SITE_URL).replace(/\/$/, "");
  const live = posts.filter((p) => p.published && p.publishedAt && p.publishedAt <= now);
  const targets: { path: string; isPost: boolean; id: string; hasCover: boolean }[] = [
    { path: "/", isPost: false, id: "", hasCover: false },
    { path: "/blog", isPost: false, id: "", hasCover: false },
    { path: "/about", isPost: false, id: "", hasCover: false },
    { path: "/oferta", isPost: false, id: "", hasCover: false },
    { path: "/privacy", isPost: false, id: "", hasCover: false },
    ...NICHES.map((n) => ({ path: nichePath(n.slug), isPost: false, id: "", hasCover: false })),
    ...live.slice(0, MAX_PAGES - 5 - NICHES.length).map((p) => ({ path: `/blog/${p.slug}`, isPost: true, id: p.id, hasCover: p.hasCover })),
  ];

  // Публичный адрес — для проверок, которые должны смотреть на сайт «снаружи» (SSL, www, http, скорость)
  const publicUrl = (process.env.NEXTAUTH_URL || SITE_URL).replace(/\/$/, "");
  const publicHost = (() => { try { return new URL(publicUrl).host; } catch { return ""; } })();
  const publicOk = !!publicHost && !/^(localhost|127\.|0\.0\.0\.0)/.test(publicHost);

  // Медленные внешние запросы стартуют сразу и идут параллельно с обходом страниц
  const psiJob: Promise<PsiResult[] | null> = publicOk
    ? withDeadline(
        Promise.all((["mobile", "desktop"] as const).map((st) => fetchPsi(`${publicUrl}/`, st, process.env.PAGESPEED_API_KEY, fetch, 38000))),
        40000
      )
    : Promise.resolve(null);
  const webmasterJob = withDeadline(
    (async () => {
      const token = (await getKey("YANDEX_WEBMASTER_TOKEN")).value;
      if (!token) return null;
      const host = (await getKey("YANDEX_WEBMASTER_HOST")).value;
      try {
        const r = await fetchYandexReport(token, publicUrl, host || undefined);
        return { at: new Date().toISOString(), sqi: r.sqi, searchablePages: r.searchablePages, excludedPages: r.excludedPages, problems: r.problems.map((p) => ({ code: p.code, severity: p.severity, state: p.state })), error: "" };
      } catch (e) {
        return { at: new Date().toISOString(), sqi: null, searchablePages: null, excludedPages: null, problems: [], error: e instanceof Error ? e.message.slice(0, 300) : "Ошибка Вебмастера" };
      }
    })(),
    20000
  ).catch(() => null);

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
  let linksChecked = 0;
  let sslExpiresAt: Date | null = null;
  const crawled: { path: string; d: PageDetails; res: Fetched }[] = [];
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
      if (res.status === 200) {
        const d = extractDetails(res.text);
        crawled.push({ path: t.path, d, res });
        found.push(
          ...auditPageDeep(d, {
            path: t.path, isPost: t.isPost, targetId: t.id, publicUrl, contentType: res.contentType,
            xRobotsTag: res.xRobotsTag, ttfbMs: res.ttfb, htmlBytes: res.bytes, requestedUrl: siteUrl + t.path, finalUrl: res.finalUrl,
          })
        );
      }
    }
    found.push(
      ...auditDuplicates(
        crawled.map(({ path, d }) => ({ path, title: d.title, description: d.description, h1: d.h1[0] ?? "", noindex: /noindex/.test(d.metaRobots) }))
      )
    );

    // Битые внутренние ссылки: проверяем адреса, которые мы не открывали при обходе
    const allLinks = collectInternalLinks(crawled.map(({ path, d }) => ({ path, links: d.links })), publicUrl);
    const known = new Set(targets.map((t) => t.path.replace(/\/+$/, "") || "/"));
    const toCheck = Array.from(allLinks.entries()).filter(([path]) => !known.has(path.replace(/\?.*$/, ""))).slice(0, 60);
    const statuses = await mapLimit(toCheck, 6, async ([path, from]) => ({ path, from, status: await linkStatus(siteUrl + path) }));
    linksChecked = statuses.length;
    found.push(...auditBrokenLinks(statuses.filter((x): x is { path: string; from: string[]; status: number } => x.status !== null)));

    // Сайт в целом: SSL, редиректы www/http, страница 404, favicon
    const origin = publicOk ? `${publicUrl.replace(/^https?:\/\//, "")}`.replace(/^www\./, "") : "";
    const [ssl, wwwRes, httpRes, nf, fav] = await Promise.all([
      publicOk ? fetchSsl(origin) : Promise.resolve(null),
      publicOk ? fetchManual(`https://www.${origin}/`) : Promise.resolve(null),
      publicOk ? fetchManual(`http://${origin}/`) : Promise.resolve(null),
      fetchOwn(`${siteUrl}/__seo-check-404-${Math.random().toString(36).slice(2, 8)}`),
      fetchOwn(`${siteUrl}/favicon.ico`),
    ]);
    sslExpiresAt = ssl?.expiresAt ?? null;
    const homeD = crawled.find((c) => c.path === "/")?.d;
    found.push(
      ...auditSiteTech(
        {
          sslExpiresAt: ssl?.expiresAt ?? null,
          sslError: ssl?.error ?? "",
          www: wwwRes,
          http: httpRes,
          notFound: nf ? { status: nf.status, html: nf.text } : null,
          favicon: fav ? { status: fav.status } : null,
          homeHasIconLink: homeD?.hasIcon ?? false,
          publicUrl: publicOk ? publicUrl : SITE_URL,
        },
        now
      )
    );
  }

  // ── скорость (PageSpeed), Вебмастер и общие метрики ──
  const psi = await psiJob.catch(() => null);
  if (psi) {
    found.push(...auditPsi(psi));
    await saveMetric("psi", { at: now.toISOString(), mobile: psi.find((r) => r.strategy === "mobile") ?? null, desktop: psi.find((r) => r.strategy === "desktop") ?? null });
  }
  const wm = await webmasterJob;
  if (wm) await saveMetric("webmaster", wm);
  if (crawled.length) {
    const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    await saveMetric("site", {
      at: now.toISOString(),
      pagesChecked,
      avgMs: avg(crawled.map((c) => c.res.ms)),
      avgTtfb: avg(crawled.map((c) => c.res.ttfb)),
      avgHtmlKb: avg(crawled.map((c) => c.res.bytes / 1024)),
      sslExpiresAt: sslExpiresAt ? sslExpiresAt.toISOString() : null,
      linksChecked,
    });
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

