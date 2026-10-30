import assert from "node:assert";
import { generateKeyPairSync } from "node:crypto";
import {
  buildPositionsView, normalizeQuery, parseTargetsInput, prepareRows, mskDayString, MAX_TARGETS, MAX_ROWS_PER_DAY, PositionRow,
} from "../lib/positionsCore";
import { collectWith } from "../lib/positionsCore";
import { fetchGoogleQueryList, fetchYandexQueryList, SearchEngineError } from "../lib/searchEngines";

let n = 0;
const ok = (name: string, fn: () => void) => { fn(); n++; };
const okA = async (name: string, fn: () => Promise<void>) => { await fn(); n++; };

ok("нормализация запроса", () => {
  assert.equal(normalizeQuery("  Как  ПРИВЛЕЧЬ\tклиентов, Ёлка "), "как привлечь клиентов, елка");
  assert.equal(normalizeQuery(5 as never), "");
  assert.equal(normalizeQuery("a".repeat(300)).length, 120);
});
ok("ввод списка запросов", () => {
  const r = parseTargetsInput("Один запрос\nодин  запрос\n\nДва; Три", ["два"]);
  assert.deepEqual(r.add, ["один запрос", "три"]);
  assert.equal(r.skipped, 2);
  assert.equal(r.overLimit, false);
  const big = parseTargetsInput(Array.from({ length: 150 }, (_, i) => "q" + i).join("\n"));
  assert.equal(big.add.length, MAX_TARGETS);
  assert.equal(big.overLimit, true);
});
ok("день по Москве", () => {
  assert.equal(mskDayString(new Date("2026-10-30T22:30:00Z")), "2026-10-31");
});
ok("подготовка строк: объединение, отсев, лимит, свои запросы", () => {
  const rows = prepareRows([
    { query: "Купить Ёлку", shows: 10, clicks: 1, position: 4 },
    { query: "купить елку", shows: 30, clicks: 2, position: 8 },
    { query: "без позиции", shows: 5, clicks: 0, position: null },
    { query: "ноль", shows: 5, clicks: 0, position: 0 },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].query, "купить елку");
  assert.equal(rows[0].shows, 40); assert.equal(rows[0].clicks, 3);
  assert.equal(rows[0].position, 7); // (4*10+8*30)/40
  const many = Array.from({ length: MAX_ROWS_PER_DAY + 20 }, (_, i) => ({ query: "q" + i, shows: 1000 - i, clicks: 0, position: 5 }));
  assert.equal(prepareRows(many).length, MAX_ROWS_PER_DAY);
  assert.equal(prepareRows(many, new Set(["q" + (MAX_ROWS_PER_DAY + 5)])).length, MAX_ROWS_PER_DAY + 1);
});
const row = (engine: string, day: string, query: string, position: number, shows = 100, clicks = 5): PositionRow => ({ engine, day, query, position, shows, clicks });
ok("вид: позиции, сдвиг за неделю, история, остальные запросы", () => {
  const targets = [{ id: "t1", query: "план продвижения" }, { id: "t2", query: "нет данных" }];
  const rows = [
    row("yandex", "2026-10-20", "план продвижения", 12),
    row("yandex", "2026-10-26", "план продвижения", 9),
    row("yandex", "2026-10-28", "план продвижения", 7.5),
    row("yandex", "2026-10-28", "другой запрос", 3, 500, 40),
    row("google", "2026-10-27", "план продвижения", 15),
    row("google", "2026-10-27", "чужой запрос", 40, 10, 0),
  ];
  const v = buildPositionsView(targets, rows);
  const t1 = v.targets[0];
  assert.equal(t1.yandex!.position, 7.5);
  assert.equal(t1.yandex!.change, 4.5); // с позиции 12 (20.10 ≤ 28.10−7) на 7,5
  assert.equal(t1.yandex!.series.length, 3);
  assert.equal(t1.google!.position, 15);
  assert.equal(t1.google!.change, null); // нет данных старше недели
  assert.equal(v.targets[1].yandex, null);
  assert.equal(v.lastDay.yandex, "2026-10-28"); assert.equal(v.lastDay.google, "2026-10-27");
  assert.deepEqual(v.others.yandex.map((o) => o.query), ["другой запрос", "план продвижения"]);
  assert.equal(v.others.yandex[1].tracked, true);
  assert.equal(v.others.yandex[0].tracked, false);
});
ok("вид: падение даёт отрицательный сдвиг", () => {
  const v = buildPositionsView([{ id: "a", query: "x" }], [row("google", "2026-10-01", "x", 3), row("google", "2026-10-10", "x", 8)]);
  assert.equal(v.targets[0].google!.change, -5);
});

// ───── запросы к Вебмастеру и Search Console на подменённом fetch ─────
const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
const yandexMock = (calls: string[]) => (async (url: any) => {
  const u = String(url);
  calls.push(u);
  if (u.endsWith("/v4/user")) return json({ user_id: 77 });
  if (u.endsWith("/hosts")) return json({ hosts: [
    { host_id: "http:m-navi.ru:80", ascii_host_url: "http://m-navi.ru", verified: false },
    { host_id: "https:m-navi.ru:443", ascii_host_url: "https://m-navi.ru", verified: true },
  ] });
  if (u.includes("/hosts/https:m-navi.ru:443/search-queries/popular")) {
    return json({ date_from: "2026-10-20", date_to: "2026-10-26", queries: [
      { query_text: "маркетинговый план", indicators: { TOTAL_SHOWS: 120, TOTAL_CLICKS: 9, AVG_SHOW_POSITION: 6.4 } },
      { query_text: "без позиции", indicators: { TOTAL_SHOWS: 3, TOTAL_CLICKS: 0 } },
    ] });
  }
  return json({ error_code: "HOST_NOT_VERIFIED" }, 404);
}) as typeof fetch;

(async () => {
  await okA("Яндекс: список запросов и параметр limit", async () => {
    const calls: string[] = [];
    const r = await fetchYandexQueryList("tok", "https://m-navi.ru", undefined, yandexMock(calls));
    assert.equal(r.queries.length, 2);
    assert.equal(r.queries[0].query, "маркетинговый план");
    assert.equal(r.queries[0].position, 6.4);
    assert.equal(r.queries[1].position, null);
    assert.equal(r.dateFrom, "2026-10-20");
    assert.ok(calls.some((c) => c.includes("limit=500") && c.includes("AVG_SHOW_POSITION")));
  });
  await okA("Яндекс: неподтверждённый вариант сайта пропускается", async () => {
    const f = (async (url: any) => {
      const u = String(url);
      if (u.endsWith("/v4/user")) return json({ user_id: 1 });
      if (u.endsWith("/hosts")) return json({ hosts: [
        { host_id: "https:m-navi.ru:443", ascii_host_url: "https://m-navi.ru", verified: true },
        { host_id: "http:m-navi.ru:80", ascii_host_url: "http://m-navi.ru", verified: true },
      ] });
      if (u.includes("/hosts/https:")) return new Response(JSON.stringify({ error_code: "HOST_NOT_VERIFIED" }), { status: 404 });
      return json({ queries: [{ query_text: "ok", indicators: { TOTAL_SHOWS: 1, TOTAL_CLICKS: 0, AVG_SHOW_POSITION: 2 } }] });
    }) as typeof fetch;
    const r = await fetchYandexQueryList("tok", "https://m-navi.ru", undefined, f);
    assert.equal(r.queries[0].query, "ok");
  });
  await okA("Яндекс: отказ доступа — понятная ошибка", async () => {
    const f = (async () => new Response("{}", { status: 403 })) as typeof fetch;
    await assert.rejects(() => fetchYandexQueryList("bad", "https://m-navi.ru", undefined, f), SearchEngineError);
  });
  await okA("Google: запрос за 7 дней с задержкой, позиции и клики", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    let body: any = null;
    const f = (async (url: any, init: any) => {
      const u = String(url);
      if (u.includes("oauth2.googleapis.com")) return json({ access_token: "at" });
      body = JSON.parse(init.body);
      return json({ rows: [
        { keys: ["маркетинговый план"], clicks: 4, impressions: 80, ctr: 0.05, position: 11.26 },
        { keys: ["пустая позиция"], clicks: 0, impressions: 2, ctr: 0, position: 0 },
      ] });
    }) as typeof fetch;
    const r = await fetchGoogleQueryList({ clientEmail: "a@b.iam", privateKey: pem }, "https://m-navi.ru/", f, new Date("2026-10-30T12:00:00Z"), 1000);
    assert.equal(r.dateTo, "2026-10-27"); assert.equal(r.dateFrom, "2026-10-21");
    assert.deepEqual(body.dimensions, ["query"]); assert.equal(body.rowLimit, 1000);
    assert.equal(r.queries[0].position, 11.3); assert.equal(r.queries[0].clicks, 4); assert.equal(r.queries[0].shows, 80);
    assert.equal(r.queries[1].position, null);
  });

  // ───── сбор: ошибка одной системы не мешает другой, пустой ответ ничего не стирает ─────
  await okA("сбор: Яндекс упал, Google сохранился; не подключено", async () => {
    const saved: any[] = [];
    const res = await collectWith({
      now: new Date("2026-10-30T09:00:00Z"),
      targets: ["свой запрос"],
      yandex: async () => { throw new SearchEngineError("Яндекс Вебмастер: ошибка 404"); },
      google: async () => ({ queries: [{ query: "Свой Запрос", shows: 5, clicks: 1, position: 9 }], dateFrom: "a", dateTo: "b" }),
      save: async (engine, day, rows) => { saved.push({ engine, day, rows }); },
    });
    assert.equal(res[0].status, "error"); assert.match(res[0].message!, /404/);
    assert.equal(res[1].status, "ok"); assert.equal(res[1].saved, 1);
    assert.equal(saved.length, 1); assert.equal(saved[0].day, "2026-10-30"); assert.equal(saved[0].rows[0].query, "свой запрос");
    const r2 = await collectWith({ now: new Date(), targets: [], save: async () => { throw new Error("не должен вызываться"); } });
    assert.deepEqual(r2.map((r) => r.status), ["not_connected", "not_connected"]);
  });
  await okA("сбор: пустой ответ не стирает старые данные", async () => {
    let calls = 0;
    const res = await collectWith({
      now: new Date(), targets: [],
      yandex: async () => ({ queries: [], dateFrom: null, dateTo: null }),
      save: async () => { calls++; },
    });
    assert.equal(res[0].status, "no_data"); assert.equal(calls, 0);
  });

  console.log(`ВСЕ ТЕСТЫ ПРОШЛИ (${n})`);
})().catch((e) => { console.error(e); process.exit(1); });
