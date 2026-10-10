"use client";

import { useCallback, useEffect, useState } from "react";

interface KeyStatus {
  name: string;
  set: boolean;
  source: "admin" | "env" | null;
  value?: string;
}
interface YReport {
  host: string;
  hostUrl: string;
  sqi: number | null;
  searchablePages: number | null;
  excludedPages: number | null;
  problemCounts: Record<string, number>;
  queries: { query: string; shows: number; clicks: number; position: number | null }[];
  dateFrom: string | null;
  dateTo: string | null;
  problems: { code: string; severity: string; state: string }[];
}
interface GReport {
  siteUrl: string;
  startDate: string;
  endDate: string;
  queries: { key: string; clicks: number; impressions: number; ctr: number; position: number }[];
  pages: { key: string; clicks: number; impressions: number; ctr: number; position: number }[];
  sitemaps: { path: string; lastDownloaded: string | null; errors: number; warnings: number }[];
}

const input = "w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet";
const btn = "rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50";
const btn2 = "rounded-full border border-ink-900/20 px-5 py-2.5 text-sm font-medium text-ink-900 hover:bg-soft disabled:opacity-50";

const SEVERITY: Record<string, { label: string; cls: string }> = {
  FATAL: { label: "Фатальная", cls: "bg-red-600 text-white" },
  CRITICAL: { label: "Критичная", cls: "bg-red-100 text-red-700" },
  POSSIBLE_PROBLEM: { label: "Возможная проблема", cls: "bg-amber-100 text-amber-800" },
  RECOMMENDATION: { label: "Рекомендация", cls: "bg-soft text-ink-900/70" },
};

function Badge({ k }: { k?: KeyStatus }) {
  if (!k?.set) return <span className="rounded-full bg-soft px-2.5 py-0.5 text-[11px] font-bold text-muted">не задан</span>;
  return (
    <span className="rounded-full bg-green-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
      задан{k.source === "env" ? " (переменная окружения)" : ""}
    </span>
  );
}

export default function AdminSearchEnginesTab() {
  const [keys, setKeys] = useState<KeyStatus[]>([]);
  const [siteUrl, setSiteUrl] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [yToken, setYToken] = useState("");
  const [yHost, setYHost] = useState("");
  const [gJson, setGJson] = useState("");
  const [gSite, setGSite] = useState("");

  const [yReport, setYReport] = useState<YReport | null>(null);
  const [gReport, setGReport] = useState<GReport | null>(null);
  const [yErr, setYErr] = useState<string | null>(null);
  const [gErr, setGErr] = useState<string | null>(null);

  const k = (name: string) => keys.find((x) => x.name === name);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/search-engines", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setKeys(data.keys ?? []);
    setSiteUrl(data.siteUrl ?? "");
    const host = (data.keys ?? []).find((x: KeyStatus) => x.name === "YANDEX_WEBMASTER_HOST")?.value;
    const site = (data.keys ?? []).find((x: KeyStatus) => x.name === "GOOGLE_SC_SITE_URL")?.value;
    setYHost((v) => v || host || "");
    setGSite((v) => v || site || "");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (body: Record<string, unknown>, what: string) => {
    setBusy(what);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/search-engines", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось сохранить");
      setKeys(data.keys ?? []);
      setMsg({ ok: true, text: "Сохранено. Нажмите «Проверить и загрузить данные»." });
      return true;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Не удалось сохранить" });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const pull = async (engine: "yandex" | "google") => {
    setBusy(engine);
    engine === "yandex" ? setYErr(null) : setGErr(null);
    try {
      const res = await fetch("/api/admin/search-engines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ engine }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Не удалось получить данные");
      engine === "yandex" ? setYReport(data.report) : setGReport(data.report);
    } catch (e) {
      const t = e instanceof Error ? e.message : "Не удалось получить данные";
      engine === "yandex" ? setYErr(t) : setGErr(t);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">
        Подключите Яндекс Вебмастер и Google Search Console, чтобы видеть реальные запросы, показы, клики, позиции и рекомендации
        поисковиков для {siteUrl || "сайта"}. Ключи хранятся в базе зашифрованными и никогда не показываются обратно. Можно также задать их
        переменными окружения на сервере.
      </p>
      {msg && <p className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      {/* ───── Яндекс ───── */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <h3 className="font-display text-lg text-ink-900">Яндекс Вебмастер</h3>
          <Badge k={k("YANDEX_WEBMASTER_TOKEN")} />
        </div>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Сайт должен быть добавлен и подтверждён в Яндекс Вебмастере.</li>
          <li>Создайте OAuth-приложение на oauth.yandex.ru с правами «Яндекс.Вебмастер: получение информации о сайтах» (webmaster:hostinfo) и получите токен.</li>
          <li>Вставьте токен ниже. Идентификатор сайта (host_id) обычно определяется сам.</li>
        </ol>
        <div className="grid gap-3">
          <input type="password" autoComplete="off" value={yToken} onChange={(e) => setYToken(e.target.value)} placeholder="OAuth-токен Яндекса" className={input} />
          <input value={yHost} onChange={(e) => setYHost(e.target.value)} placeholder="host_id (необязательно), например https:m-navi.ru:443" className={input} />
          <div className="flex flex-wrap gap-3">
            <button className={btn} disabled={busy !== null || (!yToken && yHost === (k("YANDEX_WEBMASTER_HOST")?.value ?? ""))} onClick={async () => { if (await save({ yandexToken: yToken, yandexHost: yHost }, "ysave")) setYToken(""); }}>
              Сохранить
            </button>
            <button className={btn2} disabled={busy !== null || !k("YANDEX_WEBMASTER_TOKEN")?.set} onClick={() => pull("yandex")}>
              {busy === "yandex" ? "Загружаем…" : "Проверить и загрузить данные"}
            </button>
            {k("YANDEX_WEBMASTER_TOKEN")?.source === "admin" && (
              <button className="text-sm text-red-600 underline underline-offset-4" onClick={() => window.confirm("Удалить ключ Яндекса?") && save({ clear: "yandex" }, "yclear")}>
                Удалить ключ
              </button>
            )}
          </div>
        </div>
        {yErr && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{yErr}</p>}
        {yReport && (
          <div className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="ИКС сайта" value={yReport.sqi} />
              <Stat label="Страниц в поиске" value={yReport.searchablePages} />
              <Stat label="Исключено из поиска" value={yReport.excludedPages} />
            </div>
            {yReport.problems.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-bold text-ink-900">Рекомендации и проблемы от Яндекса</h4>
                <ul className="space-y-1.5">
                  {yReport.problems.map((p) => {
                    const s = SEVERITY[p.severity] ?? { label: p.severity || "—", cls: "bg-soft text-ink-900/70" };
                    return (
                      <li key={p.code} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.cls}`}>{s.label}</span>
                        <code className="text-xs text-ink-900/80">{p.code}</code>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div>
              <h4 className="mb-2 text-sm font-bold text-ink-900">
                Популярные запросы {yReport.dateFrom && yReport.dateTo ? `(${yReport.dateFrom} — ${yReport.dateTo})` : ""}
              </h4>
              <Table
                head={["Запрос", "Показы", "Клики", "Позиция"]}
                rows={yReport.queries.map((q) => [q.query, q.shows, q.clicks, q.position ?? "—"])}
                empty="Яндекс пока не отдаёт данные по запросам: сайт новый или показов мало."
              />
            </div>
          </div>
        )}
      </section>

      {/* ───── Google ───── */}
      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="mb-1 flex flex-wrap items-center gap-3">
          <h3 className="font-display text-lg text-ink-900">Google Search Console</h3>
          <Badge k={k("GOOGLE_SC_PRIVATE_KEY")} />
        </div>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Подтвердите сайт в Google Search Console.</li>
          <li>В Google Cloud создайте сервисный аккаунт, включите Search Console API и скачайте ключ в формате JSON.</li>
          <li>В Search Console откройте «Настройки → Пользователи и разрешения» и добавьте email сервисного аккаунта с правом «Ограниченный» или выше.</li>
          <li>Вставьте содержимое JSON-файла ниже и укажите ресурс (например, <code>sc-domain:m-navi.ru</code> или <code>https://m-navi.ru/</code>).</li>
        </ol>
        {k("GOOGLE_SC_CLIENT_EMAIL")?.value && (
          <p className="mb-3 text-sm text-ink-900">Сервисный аккаунт: <b>{k("GOOGLE_SC_CLIENT_EMAIL")?.value}</b></p>
        )}
        <div className="grid gap-3">
          <textarea value={gJson} onChange={(e) => setGJson(e.target.value)} rows={4} placeholder='Содержимое JSON-ключа: {"type": "service_account", "client_email": "...", "private_key": "..."}' className={`${input} resize-none font-mono`} />
          <input value={gSite} onChange={(e) => setGSite(e.target.value)} placeholder="Ресурс Search Console: sc-domain:m-navi.ru или https://m-navi.ru/" className={input} />
          <div className="flex flex-wrap gap-3">
            <button className={btn} disabled={busy !== null || (!gJson && gSite === (k("GOOGLE_SC_SITE_URL")?.value ?? ""))} onClick={async () => { if (await save({ googleJson: gJson, googleSite: gSite }, "gsave")) setGJson(""); }}>
              Сохранить
            </button>
            <button className={btn2} disabled={busy !== null || !k("GOOGLE_SC_PRIVATE_KEY")?.set} onClick={() => pull("google")}>
              {busy === "google" ? "Загружаем…" : "Проверить и загрузить данные"}
            </button>
            {k("GOOGLE_SC_PRIVATE_KEY")?.source === "admin" && (
              <button className="text-sm text-red-600 underline underline-offset-4" onClick={() => window.confirm("Удалить ключ Google?") && save({ clear: "google" }, "gclear")}>
                Удалить ключ
              </button>
            )}
          </div>
        </div>
        {gErr && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{gErr}</p>}
        {gReport && (
          <div className="mt-6 space-y-5">
            <div>
              <h4 className="mb-2 text-sm font-bold text-ink-900">Запросы за период {gReport.startDate} — {gReport.endDate}</h4>
              <Table
                head={["Запрос", "Клики", "Показы", "CTR, %", "Позиция"]}
                rows={gReport.queries.map((q) => [q.key, q.clicks, q.impressions, q.ctr, q.position])}
                empty="Google пока не отдаёт данные по запросам за этот период."
              />
            </div>
            <div>
              <h4 className="mb-2 text-sm font-bold text-ink-900">Страницы</h4>
              <Table
                head={["Страница", "Клики", "Показы", "CTR, %", "Позиция"]}
                rows={gReport.pages.map((q) => [q.key.replace(/^https?:\/\/[^/]+/, "") || "/", q.clicks, q.impressions, q.ctr, q.position])}
                empty="Данных по страницам пока нет."
              />
            </div>
            {gReport.sitemaps.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-bold text-ink-900">Карты сайта</h4>
                <ul className="space-y-1 text-sm">
                  {gReport.sitemaps.map((s) => (
                    <li key={s.path} className="text-ink-900/80">
                      {s.path} · ошибок: {s.errors}, предупреждений: {s.warnings}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl bg-soft p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-2xl text-ink-900">{value ?? "—"}</p>
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="bg-soft text-xs text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`px-3 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${j > 0 ? "text-right tabular-nums" : "break-all"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
