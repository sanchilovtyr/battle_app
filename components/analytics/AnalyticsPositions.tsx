"use client";

import { useCallback, useEffect, useState } from "react";
import type { EngineCell, OtherQuery, PositionsView } from "@/lib/positionsCore";

type View = PositionsView & { connected: { yandex: boolean; google: boolean } };
interface RefreshResult { engine: "yandex" | "google"; status: string; saved: number; message?: string }

const num = (n: number) => n.toLocaleString("ru-RU");
const pos = (n: number) => n.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
const fmtDay = (d: string | null) => (d ? d.slice(8, 10) + "." + d.slice(5, 7) + "." + d.slice(2, 4) : "—");
const th = "whitespace-nowrap px-2 py-2 text-left text-xs font-medium text-muted";
const td = "px-2 py-2 align-middle text-sm text-ink-900";
const btn = "rounded-full bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50";
const btn2 = "rounded-full border border-ink-900/20 px-4 py-2 text-sm font-medium text-ink-900 hover:bg-soft disabled:opacity-50";

/** Цвет места: чем ближе к первой строке, тем зеленее */
function posClass(p: number): string {
  if (p <= 3) return "text-green-700";
  if (p <= 10) return "text-ink-900";
  if (p <= 20) return "text-amber-600";
  return "text-muted";
}

function Spark({ series }: { series: { day: string; position: number }[] }) {
  if (series.length < 2) return <span className="text-xs text-muted">накапливается</span>;
  const w = 84, h = 26, pad = 3;
  const ps = series.map((s) => s.position);
  const lo = Math.min(...ps), hi = Math.max(...ps);
  const span = Math.max(1, hi - lo);
  // чем выше линия, тем лучше (меньшее число — ближе к первому месту)
  const pts = series.map((s, i) => `${pad + (i / (series.length - 1)) * (w - pad * 2)},${pad + ((s.position - lo) / span) * (h - pad * 2)}`);
  return (
    <svg width={w} height={h} role="img" aria-label={`Позиция за ${series.length} дн.: от ${pos(series[0].position)} до ${pos(series[series.length - 1].position)}`}>
      <polyline points={pts.join(" ")} fill="none" stroke="#7c5cff" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2.4" fill="#7c5cff" />
    </svg>
  );
}

function Change({ c }: { c: number | null }) {
  if (c == null) return <span className="text-xs text-muted" title="Нет данных за неделю назад">нет сравнения</span>;
  if (Math.abs(c) < 0.1) return <span className="text-xs text-muted">без изменений</span>;
  return c > 0 ? (
    <span className="text-xs font-semibold text-green-700" title="Поднялись по сравнению с неделей назад">▲ {pos(c)}</span>
  ) : (
    <span className="text-xs font-semibold text-red-600" title="Опустились по сравнению с неделей назад">▼ {pos(-c)}</span>
  );
}

function Cell({ c, connected }: { c: EngineCell | null; connected: boolean }) {
  if (!c && !connected) return <td className={`${td} text-xs text-muted`} colSpan={2}>не подключено</td>;
  if (!c)
    return (
      <td className={`${td} text-xs text-muted`} colSpan={2} title="По запросу нет показов за период или данные ещё не загружены">
        нет показов
      </td>
    );
  return (
    <>
      <td className={td}>
        <div className={`font-display text-xl leading-none ${posClass(c.position)}`}>{pos(c.position)}</div>
        <div className="mt-1"><Change c={c.change} /></div>
      </td>
      <td className={td}>
        <div className="text-xs text-muted">{num(c.shows)} показов · {num(c.clicks)} кликов</div>
        <div className="mt-1"><Spark series={c.series} /></div>
      </td>
    </>
  );
}

export default function AnalyticsPositions() {
  const [data, setData] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [results, setResults] = useState<RefreshResult[] | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/positions");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Ошибка загрузки");
      setData(j as View);
      setError(null);
    } catch (e) {
      setError(String((e as Error).message || e));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/admin/positions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j?.error || "Ошибка");
    return j;
  };

  const add = async (value: string, key = "add") => {
    setBusy(key);
    setMsg(null);
    try {
      const j = await post({ action: "add", text: value });
      setMsg({
        ok: true,
        text: j.added
          ? `Добавлено запросов: ${j.added}.${j.skipped ? ` Уже были в списке: ${j.skipped}.` : ""}${j.overLimit ? " Достигнут предел списка (100)." : ""} Позиции появятся после следующей загрузки данных — нажмите «Обновить данные».`
          : j.skipped
          ? "Эти запросы уже в списке."
          : j.overLimit
          ? "Достигнут предел списка (100 запросов)."
          : "Нечего добавлять.",
      });
      if (j.added) setText("");
      await load();
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error).message) });
    }
    setBusy(null);
  };

  const remove = async (id: string, q: string) => {
    if (!window.confirm(`Убрать запрос «${q}» из отслеживаемых? История позиций сохранится в базе.`)) return;
    setBusy("rm" + id);
    try {
      await post({ action: "remove", id });
      await load();
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error).message) });
    }
    setBusy(null);
  };

  const refresh = async () => {
    setBusy("refresh");
    setMsg(null);
    setResults(null);
    try {
      const j = await post({ action: "refresh" });
      setResults(j.results as RefreshResult[]);
      await load();
    } catch (e) {
      setMsg({ ok: false, text: String((e as Error).message) });
    }
    setBusy(null);
  };

  const connected = data?.connected ?? { yandex: false, google: false };
  const resultText = (r: RefreshResult) =>
    r.status === "ok" ? `загружено запросов: ${num(r.saved)}` : r.status === "not_connected" ? "не подключено" : r.message || "ошибка";

  return (
    <div>
      <p className="mb-5 rounded-xl border border-line bg-soft p-3 text-xs text-muted">
        Данные берутся из Яндекс Вебмастера и Google Search Console. «Место» — средняя позиция, на которой сайт показывался по запросу за последнюю неделю, а не мгновенная выдача: она зависит от региона и персонализации, поэтому живой поиск может отличаться. Данные запаздывают на 2–3 дня, снимок сохраняется раз в сутки (после первой загрузки график копит историю). «Нет показов» — по запросу сайт не показывался или система пока не отдаёт данные. Запросы с совсем малым числом показов Google может не раскрывать.
      </p>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">{error}</div>}
      {!data && !error && <p className="text-sm text-muted">Загрузка…</p>}

      {data && (
        <>
          {!connected.yandex && !connected.google && (
            <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
              Ни Яндекс Вебмастер, ни Google Search Console не подключены. Добавьте ключи на странице «Яндекс и Google» в меню админки.
            </div>
          )}

          <section className="mb-6 rounded-2xl border border-line bg-white p-5">
            <h3 className="font-display text-base text-ink-900">Запросы, по которым продвигаемся</h3>
            <p className="mb-3 mt-1 text-xs text-muted">Впишите запросы по одному в строке (до 100). Регистр и «ё» значения не имеют.</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder={"маркетинговый план для бизнеса\nкак привлечь клиентов из интернета"}
              className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button className={btn} disabled={busy !== null || !text.trim()} onClick={() => add(text)}>
                {busy === "add" ? "Добавляем…" : "Добавить запросы"}
              </button>
              <button className={btn2} disabled={busy !== null || (!connected.yandex && !connected.google)} onClick={refresh}>
                {busy === "refresh" ? "Загружаем…" : "Обновить данные"}
              </button>
              <span className="text-xs text-muted">
                Яндекс: {fmtDay(data.lastDay.yandex)} · Google: {fmtDay(data.lastDay.google)} (дата последней загрузки)
              </span>
            </div>
            {msg && <p className={`mt-3 rounded-xl p-3 text-sm ${msg.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
            {results && (
              <ul className="mt-3 space-y-1 rounded-xl bg-soft p-3 text-sm text-ink-900">
                {results.map((r) => (
                  <li key={r.engine}>
                    <span className="font-medium">{r.engine === "yandex" ? "Яндекс" : "Google"}:</span>{" "}
                    <span className={r.status === "error" ? "text-red-700" : "text-muted"}>{resultText(r)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mb-6 rounded-2xl border border-line bg-white p-5">
            <h3 className="mb-3 font-display text-base text-ink-900">Позиции по вашим запросам</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th className={th} rowSpan={2}>Запрос</th>
                    <th className={th} colSpan={2}>Яндекс</th>
                    <th className={th} colSpan={2}>Google</th>
                    <th className={th} rowSpan={2} />
                  </tr>
                  <tr>
                    <th className={th}>Место</th>
                    <th className={th}>Неделя · динамика</th>
                    <th className={th}>Место</th>
                    <th className={th}>Неделя · динамика</th>
                  </tr>
                </thead>
                <tbody>
                  {data.targets.map((t) => (
                    <tr key={t.id} className="border-t border-line">
                      <td className={`${td} max-w-[16rem] break-words`}>{t.query}</td>
                      <Cell c={t.yandex} connected={connected.yandex} />
                      <Cell c={t.google} connected={connected.google} />
                      <td className={td}>
                        <button
                          className="text-xs text-muted underline underline-offset-4 hover:text-red-600"
                          disabled={busy !== null}
                          onClick={() => remove(t.id, t.query)}
                        >
                          убрать
                        </button>
                      </td>
                    </tr>
                  ))}
                  {data.targets.length === 0 && (
                    <tr>
                      <td className={`${td} text-muted`} colSpan={6}>
                        Пока нет отслеживаемых запросов. Добавьте их выше или выберите из списка ниже («+ отслеживать»).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {(["yandex", "google"] as const).map((eng) => (
            <section key={eng} className="mb-6 rounded-2xl border border-line bg-white p-5">
              <h3 className="font-display text-base text-ink-900">Все запросы сайта — {eng === "yandex" ? "Яндекс" : "Google"}</h3>
              <p className="mb-3 mt-1 text-xs text-muted">
                Запросы с наибольшим числом показов за последнюю неделю данных{data.lastDay[eng] ? ` (загрузка от ${fmtDay(data.lastDay[eng])})` : ""}. Клики — это и есть переходы из поиска по этой фразе.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr>
                      <th className={th}>Запрос</th>
                      <th className={th}>Место</th>
                      <th className={th}>Показы</th>
                      <th className={th}>Клики</th>
                      <th className={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {data.others[eng].map((o: OtherQuery) => (
                      <tr key={o.query} className="border-t border-line">
                        <td className={`${td} break-words`}>{o.query}</td>
                        <td className={`${td} ${posClass(o.position)}`}>{pos(o.position)}</td>
                        <td className={td}>{num(o.shows)}</td>
                        <td className={td}>{num(o.clicks)}</td>
                        <td className={td}>
                          {o.tracked ? (
                            <span className="text-xs text-muted">отслеживается</span>
                          ) : (
                            <button className="text-xs text-violet underline underline-offset-4" disabled={busy !== null} onClick={() => add(o.query, "o" + o.query)}>
                              + отслеживать
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {data.others[eng].length === 0 && (
                      <tr>
                        <td className={`${td} text-muted`} colSpan={5}>
                          {connected[eng] ? "Данных пока нет: нажмите «Обновить данные». Для нового сайта система может отдавать запросы только через 1–3 суток после подтверждения." : "Не подключено."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
