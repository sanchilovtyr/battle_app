"use client";

import { useEffect, useState } from "react";
import type { Report } from "@/lib/analyticsCore";

const num = (n: number) => n.toLocaleString("ru-RU");
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });
const fmtDay = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7);

function Tile({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs text-muted">{title}</p>
      <p className="mt-1 font-display text-2xl text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-line bg-white p-5">
      <h3 className="font-display text-base text-ink-900">{title}</h3>
      {note && <p className="mb-3 mt-1 text-xs text-muted">{note}</p>}
      {!note && <div className="mb-3" />}
      {children}
    </section>
  );
}

const th = "whitespace-nowrap px-2 py-2 text-left text-xs font-medium text-muted";
const td = "px-2 py-2 align-top text-sm text-ink-900";

export default function AnalyticsReport({ query }: { query: string }) {
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    fetch(`/api/admin/analytics?${query}`)
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j?.error || "Ошибка загрузки");
        return j as Report;
      })
      .then((j) => alive && setData(j))
      .catch((e) => alive && setError(String(e.message || e)));
    return () => {
      alive = false;
    };
  }, [query]);

  const maxDay = data ? Math.max(1, ...data.daily.map((d) => d.visitors)) : 1;

  return (
    <div>
      <p className="mb-5 rounded-xl border border-line bg-soft p-3 text-xs text-muted">
        Собственный счётчик сайта. Считает посетителей по анонимному номеру в cookie (без IP и без имён), роботов исключает. Данные копятся с момента обновления сайта; посетители, которые заходили раньше или запретили cookie, в отчёт не попадают. Дни — по московскому времени.
      </p>

      {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">{error}</div>}
      {!data && !error && <p className="text-sm text-muted">Загрузка…</p>}

      {data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile title="Уникальные посетители" value={num(data.totals.uniqueVisitors)} hint={`из них новых: ${num(data.totals.newVisitors)}`} />
            <Tile title="Визиты (сессии)" value={num(data.totals.sessions)} />
            <Tile
              title="Регистрации"
              value={num(data.totals.registrations)}
              hint={`источник известен: ${num(data.totals.registrationsAttributed)}`}
            />
            <Tile
              title="Оформили тариф"
              value={num(data.totals.paid)}
              hint={`источник известен: ${num(data.totals.paidAttributed)} · ${data.totals.conversionPct}% от посетителей`}
            />
          </div>

          <Card title="Уникальные посетители по дням">
            {data.totals.sessions === 0 ? (
              <p className="text-sm text-muted">За выбранный период визитов ещё нет.</p>
            ) : (
              <div className="flex h-36 items-end gap-[3px]" role="img" aria-label="Посетители по дням">
                {data.daily.map((d) => (
                  <div key={d.day} className="group relative flex h-full flex-1 items-end" title={`${fmtDay(d.day)}: ${d.visitors} посетителей, ${d.sessions} визитов`}>
                    <div className="w-full rounded-t bg-violet" style={{ height: `${Math.max(2, (d.visitors / maxDay) * 100)}%`, opacity: d.visitors ? 1 : 0.2 }} />
                  </div>
                ))}
              </div>
            )}
            {data.daily.length > 1 && (
              <div className="mt-1 flex justify-between text-[11px] text-muted">
                <span>{fmtDay(data.daily[0].day)}</span>
                <span>{fmtDay(data.daily[data.daily.length - 1].day)}</span>
              </div>
            )}
          </Card>

          <Card title="Откуда приходят" note="Источник определяется по UTM-меткам, рекламным кликам и адресу, с которого перешёл человек.">
            {data.channels.length === 0 && <p className="text-sm text-muted">Пока нет данных.</p>}
            <div className="space-y-3">
              {data.channels.map((c) => (
                <div key={c.channel}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-ink-900">{c.label}</span>
                    <span className="text-muted">
                      {num(c.visitors)} посетит. · {num(c.sessions)} визитов · {c.share}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-soft">
                    <div className="h-full rounded-full bg-violet" style={{ width: `${c.share}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Источники, каналы и UTM-метки" note="Каждая строка — сочетание источника (utm_source или сайт), канала (utm_medium) и кампании (utm_campaign).">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th className={th}>Источник</th>
                    <th className={th}>Канал</th>
                    <th className={th}>utm_medium</th>
                    <th className={th}>utm_campaign</th>
                    <th className={th}>Посетители</th>
                    <th className={th}>Визиты</th>
                    <th className={th}>Стр./визит</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.slice(0, 60).map((s, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className={td}>{s.source}</td>
                      <td className={td}>{s.channelLabel}</td>
                      <td className={td}>{s.medium || "—"}</td>
                      <td className={td}>{s.campaign || "—"}</td>
                      <td className={td}>{num(s.visitors)}</td>
                      <td className={td}>{num(s.sessions)}</td>
                      <td className={td}>{s.pagesPerSession}</td>
                    </tr>
                  ))}
                  {data.sources.length === 0 && (
                    <tr><td className={td} colSpan={7}>Пока нет данных.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Конверсия по источникам" note="Считаются люди, которые впервые пришли за выбранный период: сколько из них зарегистрировалось и сколько оформило тариф (в любой момент после прихода). Источник — первый визит.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th className={th}>Источник</th>
                    <th className={th}>Кампания</th>
                    <th className={th}>Новых</th>
                    <th className={th}>Зарегистрировались</th>
                    <th className={th}>Оформили тариф</th>
                    <th className={th}>Конверсия</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cohorts.slice(0, 60).map((c, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className={td}>{c.source} <span className="text-muted">· {c.channelLabel}</span></td>
                      <td className={td}>{c.campaign || "—"}</td>
                      <td className={td}>{num(c.newVisitors)}</td>
                      <td className={td}>{num(c.registered)}</td>
                      <td className={td}>{num(c.paid)}</td>
                      <td className={td}>{c.conversionPct}%</td>
                    </tr>
                  ))}
                  {data.cohorts.length === 0 && (
                    <tr><td className={td} colSpan={6}>Пока нет данных.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Кто оформил тариф и откуда пришёл" note="Первая оплата каждого пользователя за период (в том числе бесплатный месяц по промокоду). «Первый визит» — откуда человек впервые пришёл на сайт, «Последний визит» — откуда он вернулся перед оплатой.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr>
                    <th className={th}>Оплата</th>
                    <th className={th}>Пользователь</th>
                    <th className={th}>Тариф</th>
                    <th className={th}>Первый визит</th>
                    <th className={th}>Источник первого визита</th>
                    <th className={th}>Последний визит перед оплатой</th>
                    <th className={th}>Дней до оплаты</th>
                  </tr>
                </thead>
                <tbody>
                  {data.conversions.map((c, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className={td}>
                        {fmtDate(c.paidAt)}
                        <div className="text-xs text-muted">{c.amountKopecks ? `${num(c.amountKopecks / 100)} ₽` : "бесплатно"}</div>
                      </td>
                      <td className={td}>{c.email}</td>
                      <td className={td}>{c.planId}</td>
                      {c.known && c.first ? (
                        <>
                          <td className={td}>{c.firstTouchAt ? fmtDate(c.firstTouchAt) : "—"}</td>
                          <td className={td}>
                            {c.first.source} <span className="text-muted">· {c.first.channelLabel}</span>
                            {(c.first.medium || c.first.campaign) && (
                              <div className="text-xs text-muted">{[c.first.medium, c.first.campaign].filter(Boolean).join(" / ")}</div>
                            )}
                            <div className="text-xs text-muted">вход: {c.first.landingPath}</div>
                          </td>
                          <td className={td}>
                            {c.last ? (
                              <>
                                {c.last.source} <span className="text-muted">· {c.last.channelLabel}</span>
                                {c.last.campaign && <div className="text-xs text-muted">{c.last.campaign}</div>}
                              </>
                            ) : "—"}
                          </td>
                          <td className={td}>{c.daysToPay}</td>
                        </>
                      ) : (
                        <td className={`${td} text-muted`} colSpan={4}>
                          Источник неизвестен: человек пришёл до подключения счётчика, запретил cookie или оплатил с другого устройства.
                        </td>
                      )}
                    </tr>
                  ))}
                  {data.conversions.length === 0 && (
                    <tr><td className={td} colSpan={7}>За выбранный период тарифы не оформляли.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Страницы входа">
            <div className="space-y-1.5 text-sm">
              {data.landing.map((l) => (
                <div key={l.path} className="flex justify-between gap-3 border-b border-line pb-1.5 last:border-0">
                  <span className="break-all text-ink-900">{l.path}</span>
                  <span className="text-muted">{num(l.sessions)}</span>
                </div>
              ))}
              {data.landing.length === 0 && <p className="text-muted">Пока нет данных.</p>}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
