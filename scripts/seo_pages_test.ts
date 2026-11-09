// Запуск: npx tsx scripts/seo_pages_test.ts  (расширенные проверки страниц, как у PR-CY; без базы и сети)
import {
  extractDetails, auditPageDeep, auditDuplicates, collectInternalLinks, auditBrokenLinks, auditSiteTech, attrOf, PageCtx,
} from "@/lib/seoPageChecks";
import { parsePsi, auditPsi, fetchPsi } from "@/lib/pageSpeed";

let fails = 0;
const ok = (c: boolean, m: string) => { if (!c) { fails++; console.log("FAIL:", m); } else console.log("ok  :", m); };
const codes = (xs: { code: string }[]) => xs.map((x) => x.code).sort();
const PUB = "https://m-navi.ru";
const ctx = (o: Partial<PageCtx> = {}): PageCtx => ({ path: "/about", isPost: false, targetId: "", publicUrl: PUB, contentType: "text/html; charset=utf-8", xRobotsTag: "", ttfbMs: 100, htmlBytes: 30000, requestedUrl: PUB + "/about", finalUrl: PUB + "/about", ...o });

const text = "Слово ".repeat(400);
const GOOD = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Ключевое слово — персональный план продвижения</title>
<meta name="description" content="Пошаговый план продвижения и привлечения клиентов для малого и среднего бизнеса в России. Четыре вопроса — готовый маршрут.">
<link rel="canonical" href="https://m-navi.ru/about"><meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:image" content="https://m-navi.ru/i.png"><meta property="og:url" content="https://m-navi.ru/about">
<link rel="icon" href="/favicon.ico"></head><body><h1>О сервисе</h1><p>${text}</p><a href="/blog">Блог</a><img src="/a.png" alt="схема"><img src="/b.png" alt=""></body></html>`;

ok(attrOf('<a href="/x" class=\'y\' data-href="no">', "href") === "/x", "attrOf: href без путаницы с data-href");
ok(attrOf("<img src=a.png>", "src") === "a.png", "attrOf: без кавычек");
const gd = extractDetails(GOOD);
ok(gd.title.startsWith("Ключевое слово") && gd.canonicals.length === 1 && gd.h1.length === 1 && gd.hasLang && gd.hasIcon, "разбор: title, canonical, H1, lang, icon");
ok(gd.words >= 400 && gd.imgs.length === 2 && gd.imgs[1].alt === "" && gd.og.url === "https://m-navi.ru/about", "разбор: слова, картинки, og");
ok(auditPageDeep(gd, ctx()).length === 0, "хорошая страница — без замечаний: " + codes(auditPageDeep(gd, ctx())).join(","));

const BAD = `<html><head><title>Кратко</title><meta http-equiv="refresh" content="5;url=/x"><meta name="robots" content="nofollow">
<link rel="canonical" href="/rel"><link rel="canonical" href="http://other.example/p"><link rel="stylesheet" href="http://m-navi.ru/s.css"></head>
<body><h1>Кратко</h1><img src="/a.png"><img src="http://cdn.example/b.png" alt="x"><a>без href</a><a href="/c"></a><a href="/x//y">дв</a><script src="http://m-navi.ru/t.js"></script></body></html>`;
const bd = extractDetails(BAD);
const bc = codes(auditPageDeep(bd, ctx({ xRobotsTag: "noindex", ttfbMs: 2000, htmlBytes: 400000, requestedUrl: PUB + "/about", finalUrl: "http://m-navi.ru/about", contentType: "text/html; charset=windows-1251" })));
for (const c of [
  "page.noindex-header", "page.nofollow", "page.meta-refresh", "page.redirect-http", "page.canonical-multiple", "page.title-short",
  "page.h1-equals-title", "page.og-incomplete", "page.img-no-alt", "page.link-no-href", "page.link-empty", "page.link-double-slash",
  "page.mixed-content", "page.html-large", "page.server-slow", "page.thin-text", "page.encoding", "page.no-lang",
]) ok(bc.includes(c), "плохая страница даёт " + c);
const rel = codes(auditPageDeep(extractDetails(`<html lang="ru"><head><meta charset="utf-8"><title>${"т".repeat(80)}</title><link rel="canonical" href="/rel"></head><body>${text}</body></html>`), ctx()));
ok(rel.includes("page.canonical-relative") && rel.includes("page.title-long") && rel.includes("page.description-long") === false, "относительный canonical и длинный title");
const foreign = codes(auditPageDeep(extractDetails(GOOD.replace("https://m-navi.ru/about\"><meta property=\"og:title\"", "https://evil.example/about\"><meta property=\"og:title\"")), ctx()));
ok(foreign.includes("page.canonical-foreign"), "canonical на другой домен — critical");
ok(codes(auditPageDeep(extractDetails(GOOD.replace('rel="canonical" href="https://', 'rel="canonical" href="http://')), ctx())).includes("page.canonical-http"), "canonical на http");
ok(codes(auditPageDeep(extractDetails(GOOD.replace('content="https://m-navi.ru/about"', 'content="https://m-navi.ru/other"')), ctx())).includes("page.og-url-mismatch"), "og:url не равен canonical");
ok(auditPageDeep(gd, ctx({ path: "/blog/x", isPost: true })).every((i) => i.code !== "page.thin-text"), "для статей «мало текста» не ругается (есть свои проверки)");
ok(codes(auditPageDeep(extractDetails(GOOD.replace('<meta property="og:image" content="https://m-navi.ru/i.png">', "")), ctx({ path: "/blog/x", isPost: true }))).includes("page.og-incomplete") === false, "у статьи без og:image сообщает старая проверка, а не дубль");
ok(codes(auditPageDeep(extractDetails(GOOD.replace("utf-8", "utf-8")), ctx({ contentType: "text/html" }))).includes("page.encoding") === false, "кодировка есть только в meta — это допустимо");
ok(codes(auditPageDeep(extractDetails(GOOD.replace('<meta charset="utf-8">', "")), ctx({ contentType: "text/html" }))).includes("page.encoding"), "кодировка нигде не указана — ругаемся");

ok(!codes(auditPageDeep(gd, ctx({ requestedUrl: "http://localhost:3000/about", finalUrl: "http://localhost:3000/about" }))).includes("page.redirect-http"), "внутренний http-адрес обхода — не ошибка");
ok(!codes(auditPageDeep(extractDetails(GOOD.replace(/content="Пошаговый[^"]*"/, `content="${"о".repeat(207)}"`)), ctx())).includes("page.description-long"), "описание в 207 символов допустимо");

// дубли
const dups = auditDuplicates([
  { path: "/a", title: "Один", description: "Д", h1: "H", noindex: false },
  { path: "/b", title: "один", description: "Д2", h1: "H", noindex: false },
  { path: "/c", title: "Один", description: "Д3", h1: "Z", noindex: true },
]);
ok(codes(dups).join() === "page.dup-h1,page.dup-title", "дубли title и H1 найдены, noindex-страница не считается: " + codes(dups).join());
ok(dups.find((d) => d.code === "page.dup-title")!.target === "/a", "target дубля — первая страница группы");

// ссылки
const links = collectInternalLinks(
  [{ path: "/", links: [{ href: "/blog/", text: "б", hasImg: false, rel: "" }, { href: "https://m-navi.ru/about#x", text: "о", hasImg: false, rel: "" }, { href: "https://other.ru/", text: "в", hasImg: false, rel: "" }, { href: "/api/me", text: "", hasImg: false, rel: "" }, { href: "mailto:a@b.c", text: "", hasImg: false, rel: "" }, { href: "#top", text: "", hasImg: false, rel: "" }] },
   { path: "/blog", links: [{ href: "/about", text: "о", hasImg: false, rel: "" }] }],
  PUB
);
ok(Array.from(links.keys()).sort().join() === "/about,/blog", "внутренние ссылки: без внешних, api, mailto и якорей: " + Array.from(links.keys()).join());
ok(links.get("/about")!.join() === "/,/blog", "ссылка помнит, на каких страницах найдена");
const broken = auditBrokenLinks([{ path: "/gone", status: 404, from: ["/"] }, { path: "/ok", status: 200, from: ["/"] }, { path: "/err", status: 500, from: ["/"] }]);
ok(broken.length === 1 && broken[0].target === "/gone", "битой считается только 404/410");

// сайт
const now = new Date("2026-11-09T12:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 86400000);
const site = (o = {}) => ({ sslExpiresAt: day(60), sslError: "", www: { status: 301, location: "https://m-navi.ru/" }, http: { status: 308, location: "https://m-navi.ru/" }, notFound: { status: 404, html: '<a href="/">Главная</a>' }, favicon: { status: 200 }, homeHasIconLink: true, publicUrl: PUB, ...o });
ok(auditSiteTech(site(), now).length === 0, "здоровый сайт — без замечаний");
ok(codes(auditSiteTech(site({ sslExpiresAt: day(5) }), now)).join() === "site.ssl-expiring" && auditSiteTech(site({ sslExpiresAt: day(5) }), now)[0].severity === "critical", "SSL < 7 дней — critical");
ok(auditSiteTech(site({ sslExpiresAt: day(15) }), now)[0].severity === "warning", "SSL < 21 дня — warning");
ok(codes(auditSiteTech(site({ sslError: "certificate has expired" }), now)).join() === "site.ssl-invalid", "недействительный SSL");
ok(codes(auditSiteTech(site({ www: { status: 200, location: "" } }), now)).join() === "site.www-redirect", "www без редиректа");
ok(codes(auditSiteTech(site({ www: { status: 302, location: "https://m-navi.ru/" } }), now)).join() === "site.www-redirect", "www с временным 302 — не годится");
ok(codes(auditSiteTech(site({ www: null, http: null }), now)).length === 0, "недоступные проверки пропускаются без ошибок");
ok(codes(auditSiteTech(site({ http: { status: 200, location: "" } }), now)).join() === "site.http-redirect", "http без редиректа на https");
ok(codes(auditSiteTech(site({ notFound: { status: 200, html: "" } }), now)).join() === "site.404-status", "мягкая 404");
ok(codes(auditSiteTech(site({ notFound: { status: 404, html: "<p>нет</p>" } }), now)).join() === "site.404-no-link", "404 без ссылки на главную");
ok(codes(auditSiteTech(site({ favicon: { status: 404 }, homeHasIconLink: false }), now)).join() === "site.no-favicon", "нет favicon");
ok(codes(auditSiteTech(site({ favicon: { status: 404 }, homeHasIconLink: true }), now)).length === 0, "favicon есть в <link> — всё хорошо");

// PageSpeed
const lh = (score: number, lcp: number, cls: number) => ({ lighthouseResult: { categories: { performance: { score } }, audits: { "largest-contentful-paint": { numericValue: lcp }, "cumulative-layout-shift": { numericValue: cls }, "first-contentful-paint": { numericValue: 1800 }, "total-blocking-time": { numericValue: 100 }, "server-response-time": { numericValue: 900 } } } });
const m = parsePsi(lh(0.7, 2200, 0.35), "mobile");
ok(m.score === 70 && m.cls === 0.35 && m.lcp === 2200 && m.ttfb === 900, "разбор ответа PageSpeed");
const pc = codes(auditPsi([m, parsePsi(lh(1, 600, 0), "desktop")]));
ok(pc.join() === "psi.mobile-cls,psi.mobile-score", "мобильный 70 и CLS 0,35 → замечания, десктоп 100 → чисто: " + pc.join());
ok(auditPsi([parsePsi(lh(0.4, 5000, 0), "mobile")]).find((i) => i.code === "psi.mobile-score")!.severity === "critical", "оценка < 50 — critical");
ok(auditPsi([parsePsi(null, "mobile")]).length === 0, "нет данных PageSpeed — без замечаний");
(async () => {
  const quota = await fetchPsi("https://x.ru/", "mobile", undefined, async () => new Response(JSON.stringify({ error: { message: "Quota exceeded" } }), { status: 429 }));
  ok(quota.score === null && /PAGESPEED_API_KEY/.test(quota.error), "лимит PageSpeed — понятная подсказка про ключ");
  const fine = await fetchPsi("https://x.ru/", "desktop", "KEY", async (u) => { ok(String(u).includes("key=KEY") && String(u).includes("strategy=desktop"), "в запросе ключ и стратегия"); return new Response(JSON.stringify(lh(0.95, 1000, 0.01)), { status: 200 }); });
  ok(fine.score === 95, "успешный запрос PageSpeed");
  if (fails) { console.log(fails, "ошибок"); process.exit(1); }
  console.log("все проверки пройдены");
})();
