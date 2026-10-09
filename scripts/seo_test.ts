// Запуск: npx tsx scripts/seo_test.ts  (проверка чистых функций SEO-монитора, без базы и сети)
import {
  auditPostContent, auditPortfolio, auditSetup, auditFetchedPage, auditRobots, auditSitemap, parsePage, computeScore, AuditPost,
  auditBotVisits, auditAiRobots, auditLlms, auditHomeStructured, extractJsonLdTypes,
} from "@/lib/seoAudit";
import { detectBot } from "@/lib/bots";
import {
  getIndexNowKey, isValidKey, normalizeUrls, buildPayload, pendingPosts, submitToIndexNow, isAccepted, keyFileUrl, INDEXNOW_ENDPOINTS,
} from "@/lib/indexnowCore";
import { auditIndexNow } from "@/lib/seoAudit";
import { buildLlmsTxt, buildLlmsFullTxt, homeJsonLd } from "@/lib/geo";
import robots from "@/app/robots";
import { MODULES } from "@/lib/modules";
import { generatePlan } from "@/lib/ruleEngine";

const now = new Date("2026-10-09T12:00:00Z");
const d = (days: number) => new Date(now.getTime() - days * 86400000);
let fails = 0;
const ok = (c: boolean, msg: string) => { if (!c) { fails++; console.log("FAIL:", msg); } else console.log("ok  :", msg); };
const codes = (xs: { code: string }[]) => xs.map((x) => x.code).sort();

const long = ("Продвижение малого бизнеса начинается с понятного плана. " + "Слово ".repeat(100) + "\n\n").repeat(1) + "## Раздел\n" + "текст ".repeat(700) + "\n[план](/#wizard)";
const good: AuditPost = { id: "g", slug: "good", title: "Как начать продвижение малого бизнеса пошагово", excerpt: "Разбираем продвижение малого бизнеса: с чего начать, сколько стоит и как считать результат без воды.", body: long, coverAlt: "схема", hasCover: true, authorName: "Автор Тестов", metaTitle: "", metaDescription: "", keywords: ["продвижение малого бизнеса"], published: true, publishedAt: d(3), createdAt: d(10), updatedAt: d(3) };
const bad: AuditPost = { id: "b", slug: "bad", title: "Коротко", excerpt: "", body: "Совсем мало текста.", coverAlt: "", hasCover: false, metaTitle: "", metaDescription: "", keywords: [], published: true, publishedAt: d(100), createdAt: d(100), updatedAt: d(100) };

ok(auditPostContent(good, now).length === 0, "хорошая статья — без замечаний: " + codes(auditPostContent(good, now)).join(","));
const badCodes = codes(auditPostContent(bad, now));
for (const c of ["post.title-length", "post.no-description", "post.no-cover", "post.thin", "post.no-headings", "post.no-keywords", "post.no-internal-links"]) ok(badCodes.includes(c), "плохая статья даёт " + c);
ok(auditPostContent({ ...bad, published: false }, now).length === 0, "черновик не проверяется как живая статья");
ok(auditPostContent({ ...bad, publishedAt: d(-2) }, now).length === 0, "отложенная (будущая) статья не проверяется");
ok(codes(auditPostContent({ ...good, keywords: ["реклама в картах"] }, now)).join() === "post.kw-not-in-intro,post.kw-not-in-title", "ключ не в заголовке/абзаце: " + codes(auditPostContent({ ...good, keywords: ["реклама в картах"] }, now)).join());
ok(codes(auditPostContent({ ...good, updatedAt: d(400), publishedAt: d(400) }, now)).includes("post.stale"), "устаревшая статья");

ok(codes(auditPortfolio([], now)).join() === "blog.empty", "пустой блог");
ok(codes(auditPortfolio([good], now)).join() === "blog.few", "мало статей: " + codes(auditPortfolio([good], now)).join());
const five = Array.from({ length: 5 }, (_, i) => ({ ...good, id: "p" + i, slug: "s" + i, title: "Статья номер " + i + " про малый бизнес и рекламу", excerpt: "Уникальное описание " + i + " " + "слово ".repeat(14), keywords: ["запрос " + i] }));
ok(auditPortfolio(five, now).length === 0, "5 свежих разных статей — чисто: " + codes(auditPortfolio(five, now)).join());
const cad = (days: number) => auditPortfolio(five.map((p) => ({ ...p, publishedAt: d(days), updatedAt: d(days) })), now).find((i) => i.code === "blog.cadence");
ok(cad(10) === undefined, "10 дней — норма");
ok(cad(20)?.severity === "warning", "20 дней — warning");
ok(cad(60)?.severity === "critical", "60 дней — critical");
const dups = auditPortfolio([{ ...five[0] }, { ...five[1], title: five[0].title, excerpt: five[0].excerpt, keywords: five[0].keywords }], now);
ok(["dup.description", "dup.main-keyword", "dup.title"].every((c) => codes(dups).includes(c)), "дубли title/description/ключа: " + codes(dups).join());
ok(codes(auditPortfolio([{ ...five[0], published: false, publishedAt: null, createdAt: d(30), updatedAt: d(30) }], now)).includes("post.draft-stale"), "залежавшийся черновик");

ok(codes(auditSetup({}, null, now)).join() === "setup.google-sc,setup.no-cron,setup.no-email,setup.yandex-webmaster", "настройка без env: " + codes(auditSetup({}, null, now)).join());
ok(auditSetup({ ADMIN_NOTIFY_EMAIL: "a@b", YANDEX_WEBMASTER_TOKEN: "t", GOOGLE_SC_CLIENT_EMAIL: "g" }, d(1), now).length === 0, "всё настроено — чисто");
ok(codes(auditSetup({ ADMIN_NOTIFY_EMAIL: "a@b", YANDEX_WEBMASTER_TOKEN: "t", GOOGLE_SC_CLIENT_EMAIL: "g" }, d(20), now)).join() === "setup.no-cron", "cron давно не запускался");

const html = `<html><head><title>Тест &amp; страница</title><meta name="description" content="Описание"/><link rel="canonical" href="https://m-navi.ru/blog/x"/><meta property="og:image" content="https://m-navi.ru/i.jpg"/><script type="application/ld+json">{}</script></head><body><h1>Один</h1></body></html>`;
const f = parsePage(html);
ok(f.title === "Тест & страница" && f.description === "Описание" && f.canonical.endsWith("/blog/x") && f.h1Count === 1 && f.ogImage.endsWith("i.jpg") && f.hasJsonLd && !f.noindex, "parsePage разбирает теги");
const pg = (o: object) => ({ path: "/blog/x", status: 200, ms: 200, html, isPost: true, targetId: "t", hasCover: true, ...o });
ok(auditFetchedPage(pg({}), "https://m-navi.ru").length === 0, "здоровая страница — чисто: " + codes(auditFetchedPage(pg({}), "https://m-navi.ru")).join());
ok(codes(auditFetchedPage(pg({ status: 500 }), "https://m-navi.ru")).join() === "page.http", "500 → page.http (и дальше не проверяем)");
ok(codes(auditFetchedPage(pg({ ms: 4500 }), "https://m-navi.ru")).join() === "page.slow", "медленная страница");
ok(codes(auditFetchedPage(pg({ html: html.replace("</head>", '<meta name="robots" content="noindex,follow"/></head>') }), "https://m-navi.ru")).includes("page.noindex"), "noindex ловится");
ok(codes(auditFetchedPage(pg({ html: "<html><body>пусто</body></html>" }), "https://m-navi.ru")).join() === "page.h1,page.no-canonical,page.no-description,page.no-jsonld,page.no-og-image,page.no-title", "пустая страница: " + codes(auditFetchedPage(pg({ html: "<html><body>пусто</body></html>" }), "https://m-navi.ru")).join());
ok(codes(auditFetchedPage(pg({ html: html.replace("/blog/x\"", "/blog/other\"") }), "https://m-navi.ru")).join() === "page.canonical-mismatch", "canonical на другую страницу");
ok(codes(auditFetchedPage(pg({ path: "/", isPost: false, html: html.replace("https://m-navi.ru/blog/x", "https://m-navi.ru") }), "https://m-navi.ru")).length === 0, "главная: canonical на корень — ок");

ok(auditRobots(200, "User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: https://m-navi.ru/sitemap.xml").length === 0, "нормальный robots");
ok(codes(auditRobots(200, "User-agent: *\nDisallow: /blog\n")).join() === "robots.blocks-blog,robots.no-sitemap", "robots закрывает блог: " + codes(auditRobots(200, "User-agent: *\nDisallow: /blog\n")).join());
ok(codes(auditRobots(200, "User-agent: *\nDisallow: /\nSitemap: x")).join() === "robots.blocks-blog", "Disallow: / — весь сайт закрыт");
ok(codes(auditRobots(404, "")).join() === "robots.missing", "нет robots.txt");
ok(auditSitemap(200, "<loc>https://m-navi.ru/blog/good</loc>", [{ slug: "good", id: "g" }]).length === 0, "статья есть в sitemap");
ok(codes(auditSitemap(200, "<loc>https://m-navi.ru/blog/good</loc>", [{ slug: "new", id: "n" }])).join() === "sitemap.missing-post", "статьи нет в sitemap");
ok(codes(auditSitemap(500, "", [])).join() === "sitemap.missing", "sitemap недоступен");


// ── роботы и ИИ ──
const ua = (s: string) => detectBot(s)?.id ?? null;
ok(ua("Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)") === "yandex", "YandexBot узнаётся");
ok(ua("Mozilla/5.0 (compatible; YandexAdditional/3.0; +http://yandex.com/bots)") === "yandex-additional", "YandexAdditional отличается от YandexBot");
ok(ua("Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)") === "google", "Googlebot узнаётся");
ok(ua("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot") === "gptbot", "GPTBot");
ok(ua("Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)") === "claudebot", "ClaudeBot");
ok(ua("Mozilla/5.0 (compatible; PerplexityBot/1.0)") === "perplexity", "PerplexityBot");
ok(ua("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36") === null, "обычный браузер — не бот");
ok(ua("") === null && detectBot(null) === null, "пустой User-Agent — не бот");

const vis = (bot: string, days: number) => ({ bot, lastSeenAt: d(days), lastVerifiedAt: null });
ok(auditBotVisits([vis("yandex", 1), vis("google", 2), vis("gptbot", 3)], d(60), now).length === 0, "роботы заходят — тихо");
ok(codes(auditBotVisits([vis("yandex", 1), vis("google", 10), vis("gptbot", 3)], d(60), now)).join() === "bots.google-stale", "Google не заходил 10 дн. — warning");
ok(auditBotVisits([vis("yandex", 1), vis("google", 25), vis("gptbot", 3)], d(60), now)[0].severity === "critical", "25 дн. — critical");
ok(codes(auditBotVisits([], d(2), now)).length === 0, "сразу после установки ложной тревоги нет");
ok(codes(auditBotVisits([], d(10), now)).join() === "bots.google-stale,bots.yandex-stale", "10 дн. наблюдения без визитов: " + codes(auditBotVisits([], d(10), now)).join());
ok(codes(auditBotVisits([vis("yandex", 1), vis("google", 1)], d(40), now)).join() === "bots.ai-none", "ИИ-боты не заходили 40 дн. — info");

const aiOk = "User-agent: *\nDisallow: /admin\n\nUser-agent: GPTBot\nUser-agent: ClaudeBot\nAllow: /\nDisallow: /admin\n";
ok(auditAiRobots(aiOk).length === 0, "ИИ-боты разрешены");
ok(codes(auditAiRobots("User-agent: GPTBot\nDisallow: /\n")).join() === "robots.blocks-ai", "GPTBot закрыт");
ok(auditAiRobots("User-agent: GPTBot\nDisallow: /\nAllow: /\n").length === 0, "Allow: / снимает запрет");
ok(auditAiRobots("User-agent: *\nDisallow: /\n").length === 0, "общий запрет ловит другая проверка, а не эта");

const llmsText = buildLlmsTxt([{ slug: "a", title: "Статья А", excerpt: "Про А", publishedAt: now }]);
ok(auditLlms(200, llmsText).length === 0, "llms.txt нормальный");
ok(codes(auditLlms(404, "")).join() === "llms.missing", "llms.txt нет");
ok(codes(auditLlms(200, "hi")).join() === "llms.thin", "llms.txt пустой");
ok(llmsText.startsWith("# Ключевое слово") && llmsText.includes("https://m-navi.ru/blog/a") && llmsText.includes("1 990"), "llms.txt: заголовок, статья, цена");
const full = buildLlmsFullTxt([{ slug: "a", title: "Статья А", excerpt: "Про А", body: "Полный текст А", publishedAt: now }]);
ok(full.includes("Полный текст А") && full.includes("### Через сколько будет результат?"), "llms-full: текст статьи и FAQ");

const ld = homeJsonLd();
const ldHtml = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Organization" })}</script><script type="application/ld+json">${JSON.stringify(ld)}</script>`;
ok(extractJsonLdTypes(ldHtml).sort().join() === "FAQPage,Organization,Service,WebSite", "типы JSON-LD: " + extractJsonLdTypes(ldHtml).sort().join());
ok(auditHomeStructured(ldHtml).length === 0, "разметка главной полная");
ok(codes(auditHomeStructured("<html></html>")).join() === "home.structured-data", "нет разметки");
ok(extractJsonLdTypes('<script type="application/ld+json">{битый</script>').length === 0, "битый JSON-LD не ломает разбор");
const offers = (ld[1] as { offers: { price: number }[] }).offers;
ok(offers.length === 4 && offers[0].price === 0 && offers[1].price === 1990, "цены в разметке из тарифов: " + offers.map((o) => o.price).join("/"));
const rb = robots();
const rules = rb.rules as { userAgent: string | string[]; disallow?: string | string[] }[];
ok(rules.length === 2 && Array.isArray(rules[1].userAgent) && rules[1].userAgent.includes("GPTBot") && (rules[1].disallow as string[]).includes("/admin"), "robots: ИИ-группа с закрытыми разделами");

ok(computeScore([]) === 100, "оценка без замечаний = 100");
ok(computeScore([{ severity: "critical" }]) === 85, "1 critical = 85");
ok(computeScore(Array(30).fill({ severity: "info" })) === 85, "info ограничены: 30 мелочей = 85");
ok(computeScore(Array(10).fill({ severity: "critical" })) === 40, "critical ограничены 60: 10 штук = 40");
ok(computeScore([...Array(10).fill({ severity: "critical" }), ...Array(20).fill({ severity: "warning" }), ...Array(30).fill({ severity: "info" })]) === 0, "оценка не уходит ниже 0");

// ── автор, шрифты, IndexNow ──
ok(codes(auditPostContent({ ...good, authorName: "" }, now)).join() === "post.no-author", "статья без автора — info");
ok(codes(auditPostContent({ ...good, authorName: "   " }, now)).join() === "post.no-author", "пробелы вместо автора не считаются");
ok(auditPostContent(good, now).length === 0, "статья с автором — без замечаний");
const fontsPage = (extra: string) => ({ path: "/", status: 200, ms: 200, isPost: false, targetId: "", hasCover: false, html: `<html><head><title>Тест страница сервиса для бизнеса</title><meta name="description" content="Описание"/><link rel="canonical" href="https://m-navi.ru"/><meta property="og:image" content="https://m-navi.ru/i.jpg"/>${extra}</head><body><h1>Один</h1></body></html>` });
ok(codes(auditFetchedPage(fontsPage('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope"/>'), "https://m-navi.ru")).includes("page.google-fonts"), "Google Fonts на главной ловится");
ok(!codes(auditFetchedPage(fontsPage('<link rel="preload" href="/fonts/manrope-latin.woff2" as="font"/>'), "https://m-navi.ru")).includes("page.google-fonts"), "свои шрифты — без замечания");
ok(!codes(auditFetchedPage({ ...fontsPage('<link href="https://fonts.googleapis.com/css2"/>'), path: "/blog" }, "https://m-navi.ru")).includes("page.google-fonts"), "про шрифты сообщаем один раз — по главной");

const k1 = getIndexNowKey({ NEXTAUTH_SECRET: "secret-a" });
ok(!!k1 && /^[0-9a-f]{32}$/.test(k1) && isValidKey(k1), "ключ IndexNow выводится из секрета: " + k1);
ok(k1 === getIndexNowKey({ NEXTAUTH_SECRET: "secret-a" }), "ключ постоянный");
ok(k1 !== getIndexNowKey({ NEXTAUTH_SECRET: "secret-b" }), "другой секрет — другой ключ");
ok(!k1!.includes("secret"), "в ключе нет секрета");
ok(getIndexNowKey({ INDEXNOW_KEY: "myCustomKey-123", NEXTAUTH_SECRET: "x" }) === "myCustomKey-123", "INDEXNOW_KEY главнее");
ok(getIndexNowKey({ INDEXNOW_KEY: "bad key!", NEXTAUTH_SECRET: "x" }) === null, "некорректный INDEXNOW_KEY отвергается");
ok(getIndexNowKey({}) === null, "без секрета ключа нет");
ok(keyFileUrl("abc12345") === "https://m-navi.ru/abc12345.txt", "адрес файла ключа");
ok(normalizeUrls(["/blog/a", "https://m-navi.ru/blog/a", "https://evil.example/x", "/blog/b#top", "not a url \u0000"]).join() === "https://m-navi.ru/blog/a,https://m-navi.ru/blog/b", "адреса: чужой домен и повторы убраны: " + normalizeUrls(["/blog/a", "https://m-navi.ru/blog/a", "https://evil.example/x", "/blog/b#top"]).join());
const pl = buildPayload("abc12345", ["https://m-navi.ru/blog/a"]);
ok(pl.host === "m-navi.ru" && pl.keyLocation === "https://m-navi.ru/abc12345.txt" && pl.urlList.length === 1, "тело запроса IndexNow");
ok(isAccepted(200) && isAccepted(202) && !isAccepted(403) && !isAccepted(0), "200 и 202 — принято");

const pp = (o: object) => ({ id: "p", slug: "s", published: true, publishedAt: d(5), updatedAt: d(5), indexNowAt: null as Date | null, ...o });
ok(pendingPosts([pp({})], now).length === 1, "ни разу не отправленная — в очереди");
ok(pendingPosts([pp({ indexNowAt: d(4) })], now).length === 0, "отправленная — не в очереди");
ok(pendingPosts([pp({ indexNowAt: d(5), updatedAt: new Date(d(5).getTime() + 1500) })], now).length === 0, "отметка об отправке сама двигает updatedAt — допуск 2 с");
ok(pendingPosts([pp({ indexNowAt: d(5), updatedAt: d(1) })], now).length === 1, "правка после отправки — снова в очереди");
ok(pendingPosts([pp({ published: false })], now).length === 0 && pendingPosts([pp({ publishedAt: d(-1) })], now).length === 0, "черновик и отложенная статья в очередь не попадают");

(async () => {
  const calls: { url: string; body: string }[] = [];
  const mk = (st: Record<string, number | "throw">) => async (url: string, init: { body: string }) => {
    calls.push({ url, body: init.body });
    const s = st[url];
    if (s === "throw") throw new Error("boom");
    return { status: s as number };
  };
  const r1 = await submitToIndexNow("abc12345", ["https://m-navi.ru/blog/a"], mk({ [INDEXNOW_ENDPOINTS.yandex]: 200, [INDEXNOW_ENDPOINTS.bing]: 202 }) as never);
  ok(r1.yandex === 200 && r1.bing === 202 && r1.error === "" && calls.length === 2, "отправка в оба поисковика");
  ok(calls.every((c) => JSON.parse(c.body).key === "abc12345" && JSON.parse(c.body).urlList[0].endsWith("/blog/a")), "в запросе ключ и адрес");
  const r2 = await submitToIndexNow("abc12345", ["https://m-navi.ru/"], mk({ [INDEXNOW_ENDPOINTS.yandex]: "throw", [INDEXNOW_ENDPOINTS.bing]: 200 }) as never);
  ok(r2.yandex === 0 && r2.bing === 200 && r2.error.includes("Яндекс"), "сбой сети: статус 0, исключения нет");

  const st = (o: object) => ({ key: "abc12345", keyFile: { status: 200, text: "abc12345\n" }, lastPing: { createdAt: d(1), yandex: 200 }, pendingSince: null as Date | null, ...o });
  ok(auditIndexNow(st({}), now).length === 0, "IndexNow в порядке — тихо");
  ok(codes(auditIndexNow(st({ key: null }), now)).join() === "indexnow.no-key", "нет ключа");
  ok(codes(auditIndexNow(st({ keyFile: { status: 404, text: "" } }), now)).join() === "indexnow.key-file", "файл ключа не открывается");
  ok(codes(auditIndexNow(st({ keyFile: { status: 200, text: "другой" } }), now)).join() === "indexnow.key-file", "в файле другой ключ");
  ok(auditIndexNow(st({ keyFile: null }), now).length === 0, "не смогли проверить файл — не тревожим");
  ok(codes(auditIndexNow(st({ lastPing: { createdAt: d(1), yandex: 403 } }), now)).join() === "indexnow.failing", "Яндекс ответил 403");
  ok(codes(auditIndexNow(st({ lastPing: { createdAt: d(1), yandex: 0 } }), now)).join() === "indexnow.failing", "нет связи с Яндексом");
  ok(auditIndexNow(st({ lastPing: null }), now).length === 0, "отправок ещё не было — не ошибка");
  ok(codes(auditIndexNow(st({ pendingSince: d(5) }), now)).join() === "indexnow.pending", "ждёт отправки больше 3 дней");
  ok(auditIndexNow(st({ pendingSince: d(1) }), now).length === 0, "ждёт сутки — нормально");

  // ── страницы ниш ──
  {
    const { NICHES } = await import("../lib/niches");
    const { CASES } = await import("../lib/cases");
    const { MODULES } = await import("../lib/modules");
    const { generatePlan } = await import("../lib/ruleEngine");
    ok(NICHES.length === 6, "шесть страниц ниш");
    ok(new Set(NICHES.map((n) => n.slug)).size === NICHES.length, "slug ниш уникальны");
    for (const n of NICHES) {
      ok(/^[a-z0-9-]+$/.test(n.slug), `slug ${n.slug} — латиница`);
      ok(n.metaTitle.length <= 80 && n.metaDescription.length >= 80 && n.metaDescription.length <= 200, `${n.slug}: длины title/description`);
      ok(n.caseTitles.length > 0 && n.caseTitles.every((t) => CASES.some((c) => c.title === t)), `${n.slug}: все кейсы существуют`);
      ok(n.caseTitles.every((t) => CASES.find((c) => c.title === t)!.type === "Кейс нашего агентства"), `${n.slug}: кейсы подписаны как кейсы агентства`);
      ok(n.faq.length >= 3 && n.obstacles.length >= 4, `${n.slug}: FAQ и препятствия заполнены`);
      const plan = generatePlan(MODULES, n.exampleAnswers);
      ok(plan.foundation.length > 0 && plan.traffic.length > 0, `${n.slug}: пример плана непустой`);
    }
    const sig = (slug: string) => { const p = generatePlan(MODULES, NICHES.find((n) => n.slug === slug)!.exampleAnswers); return [...p.traffic].map((e) => e.module.id).join(","); };
    ok(sig("studii-yogi-fitnesa") !== sig("b2b"), "планы разных ниш различаются");
  }

  // ── дашборд ──
  {
    const D = await import("../lib/dashboard");
    const P = await import("../lib/progressHistory");
    const snap = (label: string, at: string, o: object) => ({ id: label, createdAt: at, label, visitors: 100, leads: 20, sales: 5, repeat: 1, ...o });
    const m = D.periodMetrics([
      snap("Октябрь 2026", "2026-10-05T10:00:00Z", { leads: 30, sales: 9, adSpend: 15000, avgReceipt: 2000 }),
      snap("Сентябрь 2026", "2026-09-05T10:00:00Z", { visitors: 0, leads: 20, sales: 0 }),
    ]);
    ok(m[0].label === "Сентябрь 2026" && m[1].label === "Октябрь 2026", "периоды отсортированы по дате");
    ok(m[0].toLeads === null && m[0].toSales === 0, "деление на ноль даёт null, а не Infinity");
    ok(m[1].costPerLead === 500 && m[1].costPerSale === 1667 && m[1].revenue === 18000, "стоимость заявки, продажи и выручка");
    ok(m[0].costPerLead === null && m[0].revenue === null, "без бюджета и чека показателей нет");
    ok(D.shortLabel("Сентябрь 2026") === "Сен 26" && D.shortLabel("Очень длинное название") === "Очень дл…", "короткие подписи оси");
    ok(D.delta(30, 20)?.value === 50 && D.delta(30, 20)?.direction === "up", "рост на 50%");
    ok(D.delta(5, 0) === null && D.delta(0, 0)?.direction === "flat", "от нуля процент не считаем");
    ok(D.delta(12.5, 10, "points")?.value === 2.5 && D.delta(12.5, 10, "points")?.unit === "п.п.", "изменение конверсии в п.п.");
    ok(D.deltaTone(D.delta(600, 500), true) === "bad" && D.deltaTone(D.delta(400, 500), true) === "good", "для стоимости рост — плохо");
    ok(D.lastPeriods([1, 2, 3, 4], 2).join() === "3,4" && D.lastPeriods([1, 2], 0).length === 2, "фильтр последних периодов");
    ok(D.buildInsights(m, []).some((t) => t.includes("Заявок стало больше на 50%")), "вывод про рост заявок");
    ok(D.fmtDelta(D.delta(30, 20)) === "+50 %" && D.fmtNum(null) === "—", "форматирование");

    const plan = generatePlan(MODULES, { businessType: "services", goal: "leads", budget: "20to100", geo: "local" });
    const first = plan.foundation[0].module;
    const pt0 = P.makeProgressPoint(plan, {}, new Date(2026, 9, 1, 12));
    const pt1 = P.makeProgressPoint(plan, { [first.id]: first.steps.map(() => true) }, new Date(2026, 9, 1, 18));
    ok(pt0.total === 0 && pt0.date === "2026-10-01" && pt1.total > 0 && pt1.foundation > 0, "прогресс плана по этапам");
    const h = P.upsertPoint(P.upsertPoint([], pt0), pt1);
    ok(h.length === 1 && h[0].total === pt1.total, "запись за тот же день заменяется");
    const h2 = P.upsertPoint(h, { ...pt1, date: "2026-09-30" });
    ok(h2.length === 2 && h2[0].date === "2026-09-30", "точки сортируются по дате");
  }

  // ── синхронизация бизнесов с сервером ──
  {
    const B = await import("../lib/businessSync");
    const plan = generatePlan(MODULES, { businessType: "services", goal: "leads", budget: "20to100", geo: "local" });
    ok(B.isValidBusinessId("1760000000000-ab12cd") && !B.isValidBusinessId("../x") && !B.isValidBusinessId("ab"), "проверка id бизнеса");
    ok(B.sanitizePlan(plan) !== null && B.sanitizePlan({}) === null && B.sanitizePlan("x") === null, "план проверяется");
    const f = B.sanitizeFunnel([
      { id: "a", createdAt: "2026-09-01", label: "Сен", visitors: "100", leads: 20.7, sales: -5, repeat: 1, channel: "yandex_direct", evil: "<script>", reviewsRating: 9 },
      { nope: 1 },
      "str",
    ]);
    ok(f.length === 1 && f[0].visitors === 100 && f[0].leads === 21 && f[0].sales === 0, "воронка: числа приводятся и ограничиваются");
    ok(!("evil" in f[0]) && f[0].channel === "yandex_direct" && f[0].reviewsRating === 5, "воронка: лишние поля отброшены, рейтинг ≤ 5");
    ok(B.sanitizeFunnel(Array.from({ length: 50 }, (_, i) => ({ id: String(i) }))).length === 24, "воронка: не больше 24 периодов");
    ok(JSON.stringify(B.sanitizeChecklist({ seo: [true, 0, "x"], "bad key!": [true], x: "no" })) === JSON.stringify({ seo: [true, false, true] }), "чек-лист очищается");
    ok(B.sanitizeProgress([{ date: "2026-10-01", total: 150, foundation: 10 }, { date: "bad" }]).length === 1 && B.sanitizeProgress([{ date: "2026-10-01", total: 150 }])[0].total === 100, "история прогресса");
    ok(JSON.stringify(B.sanitizeTarget({ leadsPerMonth: "50", salesPerMonth: 0, x: 1 })) === JSON.stringify({ leadsPerMonth: 50 }), "цель");
    const patch = B.sanitizePatch({ checklist: { a: [true] }, junk: 1 });
    ok(Object.keys(patch).join() === "checklist", "патч содержит только присланные поля");
    ok(B.sanitizePatch({ vectorId: null }).vectorId === null && B.sanitizePatch({ name: "  " }).name === "Мой бизнес", "вектор сбрасывается, пустое имя заменяется");
  }

  // ── витрина на главной (тестовые данные) ──
  {
    const Dm = await import("../lib/demoData");
    const D2 = await import("../lib/dashboard");
    ok(Dm.DEMO_PLAN.foundation.length > 0 && Dm.DEMO_PLAN.traffic.length > 0, "демо-план построен движком");
    ok(Dm.DEMO_SNAPSHOTS.length === 6, "шесть демо-периодов");
    const pm = D2.periodMetrics(Dm.DEMO_SNAPSHOTS);
    ok(pm.every((m) => m.costPerLead !== null && m.revenue !== null && m.toLeads !== null), "в демо заполнены все показатели");
    ok(pm[5].leads > pm[0].leads && pm[5].costPerLead! < pm[0].costPerLead!, "в демо заявки растут, а их стоимость падает");
    ok(Dm.DEMO_PROGRESS.every((p, i, a) => i === 0 || p.total >= a[i - 1].total), "демо-прогресс не убывает");
    ok(Dm.DEMO_READINESS.pct > 0 && Dm.DEMO_BUSINESS.name.includes("демо"), "индекс готовности посчитан, бизнес помечен как демо");
  }
  console.log(fails === 0 ? "\nВСЕ ТЕСТЫ ПРОШЛИ" : `\nПРОВАЛЕНО: ${fails}`);
  process.exit(fails ? 1 : 0);
})();
