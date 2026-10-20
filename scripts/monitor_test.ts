// Запуск: npx tsx scripts/monitor_test.ts  (мониторинг внешних угроз: адреса, загрузка, ленты, страницы, подбор)
import http from "node:http";
import type { AddressInfo } from "node:net";
import { isPrivateAddress, parsePublicUrl, safeGet, BlockedUrlError } from "@/lib/safeFetch";
import { parseFeed, pageSnapshot, diffLines, robotsAllows, textMatches, matchNews, parseKeywords, snapshotToText, textToLines, isMeaningfulLine } from "@/lib/monitorCore";
import { runSourceFetch, runCompetitorChecks, checkCompetitorsNow, type MonitorStore, type CompetitorRow, type NewItem } from "@/lib/monitorRun";
import { keywordsForRisk, CATEGORY_KEYWORDS, TEMPLATE_KEYWORDS } from "@/lib/riskWatch";
import { UNIVERSAL_RISKS, RISK_CATEGORIES } from "@/lib/risksCore";
import { sanitizeRisks } from "@/lib/businessSync";

let fails = 0;
const ok = (c: boolean, msg: string) => { if (!c) { fails++; console.log("FAIL:", msg); } else console.log("ok  :", msg); };

(async () => {
  // ── адреса ──
  for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.1", "172.31.255.255", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "224.0.0.1", "не-ip"]) ok(isPrivateAddress(ip), "закрыт: " + ip);
  for (const ip of ["8.8.8.8", "77.88.55.60", "172.32.0.1", "2a02:6b8::2:242", "1.1.1.1"]) ok(!isPrivateAddress(ip), "открыт: " + ip);
  for (const u of ["http://localhost/", "https://127.0.0.1/", "http://169.254.169.254/latest/meta-data", "ftp://site.ru", "https://user:pw@site.ru", "https://site.ru:8080/", "https://intranet", "https://x.local/", "http://[::1]/", "file:///etc/passwd", "javascript:alert(1)", 5, ""]) ok(!parsePublicUrl(u as never).ok, "адрес отклонён: " + String(u));
  const good = parsePublicUrl("site.ru/price#top");
  ok(good.ok && good.url.toString() === "https://site.ru/price", "адрес без схемы дополняется https, якорь убирается");

  // ── safeGet на локальном сервере ──
  const server = http.createServer((req, res) => {
    if (req.url === "/ok") { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end("<html><title>Привет</title><body>Текст</body></html>"); }
    else if (req.url === "/cp1251") { res.setHeader("Content-Type", "text/html; charset=windows-1251"); res.end(Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2])); }
    else if (req.url === "/r1") { res.statusCode = 302; res.setHeader("Location", "/ok"); res.end(); }
    else if (req.url === "/loop") { res.statusCode = 302; res.setHeader("Location", "/loop"); res.end(); }
    else if (req.url === "/to-meta") { res.statusCode = 302; res.setHeader("Location", "http://169.254.169.254/latest/"); res.end(); }
    else if (req.url === "/big") { res.setHeader("Content-Type", "text/plain"); res.end("x".repeat(500_000)); }
    else if (req.url === "/slow") { setTimeout(() => res.end("late"), 1500); }
    else { res.statusCode = 404; res.end("нет"); }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const T = { allowPrivate: true };
  const r1 = await safeGet(base + "/ok", T);
  ok(r1.status === 200 && r1.body.includes("Привет"), "safeGet: страница читается");
  ok((await safeGet(base + "/cp1251", T)).body === "Привет", "safeGet: windows-1251 декодируется");
  ok((await safeGet(base + "/r1", T)).body.includes("Привет"), "safeGet: редирект выполняется");
  ok((await safeGet(base + "/missing", T)).status === 404, "safeGet: 404 возвращается статусом");
  let err = ""; try { await safeGet(base + "/loop", T); } catch (e) { err = (e as Error).message; }
  ok(/перенаправлени/.test(err), "safeGet: бесконечный редирект останавливается");
  const big = await safeGet(base + "/big", { ...T, maxBytes: 10_000 });
  ok(big.truncated && big.body.length <= 10_000, "safeGet: размер ответа ограничен");
  err = ""; try { await safeGet(base + "/slow", { ...T, timeoutMs: 300 }); } catch (e) { err = (e as Error).message; }
  ok(/вовремя/.test(err), "safeGet: таймаут");
  let blocked: unknown = null; try { await safeGet(base + "/ok"); } catch (e) { blocked = e; }
  ok(blocked instanceof BlockedUrlError, "safeGet: без allowPrivate loopback закрыт");
  server.close();

  // ── ленты ──
  const now = new Date("2026-10-19T10:00:00Z");
  const rss = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Закон &amp; штрафы]]></title><link>https://a.ru/1</link><description>&lt;p&gt;Новые правила&lt;/p&gt;</description><pubDate>Mon, 19 Oct 2026 08:00:00 +0300</pubDate></item><item><title>Будущее</title><link>https://a.ru/2</link><pubDate>Mon, 01 Jan 2029 00:00:00 GMT</pubDate></item><item><title>Без ссылки</title></item></channel></rss>`;
  const f1 = parseFeed(rss, now);
  const first1 = f1.find((x) => x.link === "https://a.ru/1");
  ok(f1.length === 2 && first1?.title === "Закон & штрафы", "RSS: CDATA и сущности, запись без ссылки отброшена");
  ok(first1?.summary === "Новые правила", "RSS: из описания убрана разметка");
  ok(f1.every((x) => x.publishedAt.getTime() <= now.getTime()), "RSS: дата из будущего заменена на текущую");
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Запись</title><link rel="alternate" href="https://b.ru/x"/><updated>2026-10-18T10:00:00Z</updated><summary>Кратко</summary></entry></feed>`;
  const f2 = parseFeed(atom, now);
  ok(f2.length === 1 && f2[0].link === "https://b.ru/x" && f2[0].summary === "Кратко", "Atom читается");
  ok(parseFeed("<html>не лента</html>", now).length === 0 && parseFeed("", now).length === 0, "не лента — пусто");

  // ── страницы ──
  const html1 = `<html><head><title>Студия</title><script>var a=1</script></head><body><nav>Меню</nav><h1>Маникюр от 1500 ₽</h1><p>Гель-лак — 2000 ₽ при записи онлайн</p><p>Педикюр от 2500 ₽ каждый будний день</p><script>x()</script><p>Работаем с 10 до 20 часов</p></body></html>`;
  const s1 = pageSnapshot(html1);
  const text1 = snapshotToText(s1.lines);
  ok(s1.title === "Студия" && s1.lines.some((l) => l.includes("1500")) && !text1.includes("var a"), "снимок: текст есть, скрипты убраны");
  const html2 = html1.replace("2000 ₽", "1800 ₽").replace("<p>Работаем с 10 до 20 часов</p>", "<p>Первое посещение со скидкой 20%</p>");
  const diff = diffLines(textToLines(text1), textToLines(snapshotToText(pageSnapshot(html2).lines)));
  ok(!!diff && diff.added.some((l) => l.includes("1800")) && diff.removed.some((l) => l.includes("2000")) && diff.added.some((l) => l.includes("скидкой")), "diff: изменение цены и новая строка найдены");
  ok(diffLines(textToLines(text1), textToLines(text1)) === null, "diff: без изменений — null");
  ok(!isMeaningfulLine("1") && !isMeaningfulLine("  ") && isMeaningfulLine("Маникюр от 1500 ₽"), "осмысленность строки");

  // ── robots ──
  const rb = "User-agent: *\nDisallow: /private\nAllow: /private/open\n\nUser-agent: KeyWordMonitor\nDisallow: /price\n";
  ok(!robotsAllows(rb, "/price"), "robots: наша группа запрещает /price");
  ok(robotsAllows(rb, "/about"), "robots: прочее разрешено");
  ok(!robotsAllows("User-agent: *\nDisallow: /", "/x") && robotsAllows("User-agent: *\nDisallow:", "/x") && robotsAllows("", "/x"), "robots: общий запрет / пустые правила");
  ok(robotsAllows("User-agent: *\nDisallow: /private\nAllow: /private/open", "/private/open") && !robotsAllows("User-agent: *\nDisallow: /private", "/private/a"), "robots: самое длинное правило");

  // ── подбор ──
  ok(textMatches("Новые законы о рекламе", ["законы"]).length === 1, "подбор: форма слова найдена");
  ok(textMatches("Он закончил работу", ["закона", "законы", "законопроект"]).length === 0, "подбор: «закончил» не цепляется на законы");
  ok(textMatches("Поставки из-за границы сократились", ["поставк"]).length === 1, "подбор: основа слова");
  ok(parseKeywords("маркировка, штраф; ab, " + "x".repeat(60)).join("|") === "маркировка|штраф", "ключевые слова: короткие и длинные отброшены");
  const news = [{ id: "1", title: "Штраф за рекламу без маркировки", summary: "", publishedAt: "2026-10-18" }, { id: "2", title: "Погода", summary: "", publishedAt: "2026-10-18" }];
  ok(matchNews(news, ["маркировк", "штраф"]).length === 1 && matchNews(news, []).length === 0, "matchNews: находит нужное, без слов пусто");
  ok(UNIVERSAL_RISKS.every((t) => (TEMPLATE_KEYWORDS[t.id]?.length ?? 0) > 0), "для каждой типовой угрозы есть ключевые слова");
  ok(RISK_CATEGORIES.every((c) => CATEGORY_KEYWORDS[c].length > 0), "для каждой категории есть ключевые слова");
  ok(keywordsForRisk({ category: "legal", watch: "мои слова" })[0] === "мои слова" && keywordsForRisk({ category: "supply" }).length > 0, "слова риска: свои важнее, иначе категория");
  const sr = sanitizeRisks([{ id: "a", title: "T", category: "legal", watch: "я".repeat(500) }]);
  ok(sr[0].watch?.length === 300, "сервер: watch обрезается до 300");

  // ── запуск на памяти ──
  const items: NewItem[] = [];
  const comps = new Map<string, CompetitorRow & { status?: string; err?: string }>();
  const changes: { competitorId: string; added: string[]; removed: string[] }[] = [];
  const src = [{ id: "s1", name: "Лента", url: "https://a.ru/rss" }, { id: "s2", name: "Сломанная", url: "https://b.ru/rss" }];
  const results: Record<string, { ok: boolean; error: string }> = {};
  const store: MonitorStore = {
    enabledSources: async () => src,
    saveSourceResult: async (id, r) => { results[id] = r; },
    saveItems: async (_s, list) => { let n = 0; for (const i of list) if (!items.some((x) => x.linkHash === i.linkHash)) { items.push(i); n++; } return n; },
    deleteOldItems: async () => 0,
    dueCompetitors: async () => [...comps.values()],
    competitorsByIds: async (ids) => ids.map((i) => comps.get(i)!).filter(Boolean),
    saveCompetitorResult: async (id, r) => { const c = comps.get(id)!; c.status = r.status; c.err = r.error; if (r.snapshot) { c.snapshotText = r.snapshot.text; c.snapshotAt = new Date(); } },
    addChange: async (c) => { changes.push(c); },
  };
  let pageHtml = html1;
  const get = async (url: string) => {
    if (url.endsWith("/robots.txt")) return { status: 404, finalUrl: url, contentType: "text/plain", body: "", truncated: false };
    if (url === "https://a.ru/rss") return { status: 200, finalUrl: url, contentType: "application/rss+xml", body: rss, truncated: false };
    if (url === "https://b.ru/rss") throw new Error("Сайт не отвечает");
    if (url.startsWith("https://c.ru")) return { status: 200, finalUrl: url, contentType: "text/html", body: pageHtml, truncated: false };
    return { status: 500, finalUrl: url, contentType: "text/html", body: "", truncated: false };
  };
  const deps = { store, get, now: () => now };
  const sr1 = await runSourceFetch(deps);
  ok(sr1.sources === 2 && sr1.failed === 1 && sr1.newItems === 2 && results.s2.ok === false && /не отвечает/.test(results.s2.error), "ленты: одна загружена, вторая помечена ошибкой");
  const sr2 = await runSourceFetch(deps);
  ok(sr2.newItems === 0, "ленты: повторная загрузка не плодит дубли");

  comps.set("c1", { id: "c1", businessId: "b1", name: "К", url: "https://c.ru/price", snapshotText: "", snapshotAt: null });
  const first = await checkCompetitorsNow(deps, ["c1"]);
  ok(first.checked === 1 && changes.length === 0 && comps.get("c1")!.status === "ok" && !!comps.get("c1")!.snapshotAt, "конкурент: первая проверка — только снимок, без «изменений»");
  const same = await runCompetitorChecks(deps);
  ok(same.changed === 0, "конкурент: без изменений тихо");
  pageHtml = html2;
  const chg = await runCompetitorChecks(deps);
  ok(chg.changed === 1 && changes[0].added.some((l) => l.includes("1800")) && changes[0].removed.some((l) => l.includes("2000")), "конкурент: изменение цены зафиксировано");
  comps.set("c2", { id: "c2", businessId: "b1", name: "Сломан", url: "https://d.ru/", snapshotText: "", snapshotAt: null });
  await checkCompetitorsNow(deps, ["c2"]);
  ok(comps.get("c2")!.status === "error" && /500/.test(comps.get("c2")!.err!), "конкурент: ошибка сайта записана");
  comps.set("c3", { id: "c3", businessId: "b1", name: "Запрет", url: "https://c.ru/private", snapshotText: "", snapshotAt: null });
  const getRobots = async (url: string, o?: unknown) => (url.endsWith("/robots.txt") ? { status: 200, finalUrl: url, contentType: "text/plain", body: "User-agent: *\nDisallow: /private", truncated: false } : get(url));
  await checkCompetitorsNow({ ...deps, get: getRobots }, ["c3"]);
  ok(comps.get("c3")!.status === "robots", "конкурент: запрет в robots.txt уважается");
  pageHtml = "<html><body>коротко</body></html>";
  comps.set("c4", { id: "c4", businessId: "b1", name: "Скрипты", url: "https://c.ru/empty", snapshotText: "", snapshotAt: null });
  await checkCompetitorsNow(deps, ["c4"]);
  ok(comps.get("c4")!.status === "error" && /почти нет текста/.test(comps.get("c4")!.err!), "конкурент: страница без текста — понятная ошибка");
  let t = 0;
  const slowDeps = { ...deps, now: () => new Date(now.getTime() + (t += 30_000)) };
  const budget = await checkCompetitorsNow(slowDeps, ["c1", "c2", "c3", "c4"], 10_000);
  ok(budget.skippedByBudget > 0, "бюджет времени: часть страниц откладывается");

  console.log(fails === 0 ? "\nВСЕ ТЕСТЫ ПРОШЛИ" : `\nПРОВАЛЕНО: ${fails}`);
  process.exit(fails ? 1 : 0);
})();
