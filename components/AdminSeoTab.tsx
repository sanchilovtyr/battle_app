"use client";

import { useEffect, useMemo, useState } from "react";
import { BOTS } from "@/lib/bots";

interface Issue {
  id: string;
  code: string;
  severity: "critical" | "warning" | "info";
  category: "content" | "technical" | "indexing" | "setup";
  title: string;
  detail: string;
  fix: string;
  target: string;
  targetId: string;
  status: "open" | "snoozed" | "ignored";
  snoozedUntil: string | null;
  firstSeenAt: string;
}

interface Run {
  id: string;
  ranAt: string;
  trigger: string;
  score: number;
  critical: number;
  warning: number;
  info: number;
  pagesChecked: number;
  networkOk: boolean;
}

interface BotRow {
  bot: string;
  kind: "search" | "ai";
  lastSeenAt: string;
  lastPath: string;
  lastVerifiedAt: string | null;
}

interface PingRow {
  id: string;
  createdAt: string;
  trigger: string;
  urlCount: number;
  yandex: number;
  bing: number;
  error: string;
}

interface IndexNowInfo {
  hasKey: boolean;
  keyUrl: string | null;
  pings: PingRow[];
  pending: number;
  tableMissing: boolean;
}

interface Resolved {
  id: string;
  title: string;
  resolvedAt: string;
}

const SEVERITY = {
  critical: { label: "Срочно", dot: "bg-red-500", chip: "bg-red-50 text-red-700", order: 0 },
  warning: { label: "Исправить", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800", order: 1 },
  info: { label: "Улучшить", dot: "bg-violet", chip: "bg-violet-soft text-violet", order: 2 },
} as const;

const CATEGORY: Record<Issue["category"], string> = {
  content: "Контент",
  technical: "Страницы",
  indexing: "Индексация",
  setup: "Подключения",
};

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.round(h / 24)} дн. назад`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

/** Свежесть визита: зелёный — до 3 дней, жёлтый — до 7, красный — давно */
function freshness(iso: string): string {
  const days = (Date.now() - new Date(iso).getTime()) / 86400000;
  return days < 3 ? "bg-violet" : days < 7 ? "bg-amber-500" : "bg-red-500";
}

function BotsPanel({ rows }: { rows: BotRow[] }) {
  const byId = new Map(rows.map((r) => [r.bot, r]));
  const main = ["yandex", "google", "bing"].map((id) => BOTS.find((b) => b.id === id)!);
  const ai = BOTS.filter((b) => b.kind === "ai");
  const [showAi, setShowAi] = useState(false);
  const aiSeen = ai.filter((b) => byId.has(b.id)).length;

  return (
    <div className="mb-6 rounded-2xl border border-line bg-white p-6">
      <h3 className="mb-1 font-display text-base text-ink-900">Роботы на сайте</h3>
      <p className="mb-4 text-xs text-muted">
        Когда робот последний раз открывал страницы вашего сайта. Учёт идёт с момента установки обновления. Официальные даты обхода
        и индексации — в Яндекс.Вебмастере и Google Search Console.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {main.map((b) => {
          const r = byId.get(b.id);
          return (
            <div key={b.id} className="rounded-xl border border-line bg-soft p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-900/60">{b.label}</p>
              {r ? (
                <>
                  <p className="mt-2 flex items-center gap-2 font-medium text-ink-900">
                    <span className={`h-2 w-2 rounded-full ${freshness(r.lastSeenAt)}`} />
                    {fmtDateTime(r.lastSeenAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted">{ago(r.lastSeenAt)} · {r.lastPath || "/"}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {r.lastVerifiedAt ? `✓ подтверждён по IP (${fmtDateTime(r.lastVerifiedAt)})` : "не подтверждён по IP — возможна подделка User-Agent"}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted">Ещё не заходил</p>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={() => setShowAi((v) => !v)} className="mt-5 text-sm font-medium text-violet underline underline-offset-4">
        ИИ-ассистенты: заходили {aiSeen} из {ai.length} {showAi ? "· скрыть" : "· показать"}
      </button>
      {showAi && (
        <ul className="mt-3 divide-y divide-line text-sm">
          {ai.map((b) => {
            const r = byId.get(b.id);
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="font-medium text-ink-900">{b.label}</span>
                  <span className="ml-2 text-xs text-muted">{b.note}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{r ? `${fmtDateTime(r.lastSeenAt)} · ${r.lastPath || "/"}` : "не заходил"}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const TRIGGER: Record<string, string> = { publish: "при сохранении статьи", cron: "по расписанию", manual: "вручную" };
const codeText = (n: number) => (n === 200 || n === 202 ? "принято" : n === 0 ? "нет связи" : `ошибка ${n}`);

function IndexNowPanel({ info, onDone }: { info: IndexNowInfo; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const send = async (all: boolean) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/seo/indexnow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all }),
      });
      const body = await res.json().catch(() => ({}));
      const r = body.result;
      if (!res.ok) setMsg(body.error || "Не удалось отправить");
      else if (r?.skipped === "no-key") setMsg("Нет ключа: задайте NEXTAUTH_SECRET или INDEXNOW_KEY.");
      else if (r?.skipped === "nothing") setMsg("Отправлять нечего: все опубликованные статьи уже отправлены.");
      else setMsg(`Отправлено адресов: ${r?.sent ?? 0}. Яндекс: ${codeText(r?.yandex ?? 0)}, Bing: ${codeText(r?.bing ?? 0)}.`);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const last = info.pings[0];
  return (
    <div className="mb-6 rounded-2xl border border-line bg-white p-6">
      <h3 className="mb-1 font-display text-base text-ink-900">Сообщить Яндексу о новых страницах (IndexNow)</h3>
      <p className="mb-4 text-xs text-muted">
        При сохранении статьи сайт сам уведомляет Яндекс и Bing, а отложенные статьи уходят ежедневной проверкой по расписанию. Это ускоряет
        обнаружение, но не гарантирует индексацию. Google протокол не поддерживает.
      </p>
      {info.tableMissing && (
        <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Журнал ещё не создан. Выполните <span className="font-mono">npx prisma db push</span>.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="text-ink-900">
          Ждут отправки: <b>{info.pending}</b>
        </span>
        <span className="text-muted">
          {last
            ? `Последняя отправка: ${ago(last.createdAt)} (${TRIGGER[last.trigger] ?? last.trigger}), адресов ${last.urlCount} — Яндекс: ${codeText(last.yandex)}`
            : "Отправок ещё не было"}
        </span>
        {info.keyUrl && (
          <a href={info.keyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-violet underline underline-offset-4">
            файл ключа
          </a>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => send(false)}
          disabled={busy || !info.hasKey}
          className="rounded-full bg-ink-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-ink-800 disabled:opacity-50"
        >
          {busy ? "Отправляем…" : "Отправить сейчас"}
        </button>
        <button onClick={() => send(true)} disabled={busy || !info.hasKey} className="text-xs font-medium text-violet underline underline-offset-4 disabled:opacity-50">
          Отправить все опубликованные заново
        </button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 85) return "text-ink-900";
  if (score >= 60) return "text-amber-700";
  return "text-red-600";
}

export default function AdminSeoTab({ onEditPost }: { onEditPost: (id: string) => void }) {
  const [data, setData] = useState<{ runs: Run[]; issues: Issue[]; resolved: Resolved[]; bots?: BotRow[]; indexNow?: IndexNowInfo; needsDbPush?: boolean } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Issue["category"]>("all");
  const [showMuted, setShowMuted] = useState(false);

  const load = () =>
    fetch("/api/admin/seo")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const runNow = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/seo", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setError(body.error || "Не удалось выполнить проверку");
      await load();
    } finally {
      setRunning(false);
    }
  };

  const act = async (id: string, action: "snooze" | "ignore" | "reopen") => {
    await fetch(`/api/admin/seo/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load();
  };

  const now = Date.now();
  const { active, muted } = useMemo(() => {
    const all = data?.issues ?? [];
    const isMuted = (i: Issue) =>
      i.status === "ignored" || (i.status === "snoozed" && i.snoozedUntil && new Date(i.snoozedUntil).getTime() > now);
    return {
      active: all
        .filter((i) => !isMuted(i))
        .filter((i) => filter === "all" || i.category === filter)
        .sort((a, b) => SEVERITY[a.severity].order - SEVERITY[b.severity].order),
      muted: all.filter(isMuted),
    };
  }, [data, filter, now]);

  const last = data?.runs[0];
  const prev = data?.runs[1];
  const delta = last && prev ? last.score - prev.score : 0;

  if (!data) return <p className="text-sm text-muted">Загрузка…</p>;

  return (
    <div>
      {data.needsDbPush && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          Таблицы монитора ещё не созданы. Выполните <span className="font-mono">npx prisma db push</span> и обновите страницу.
        </p>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-[220px_1fr]">
        <div className="rounded-2xl border border-line bg-white p-6 text-center">
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-900/60">Здоровье сайта</p>
          {last ? (
            <>
              <p className={`font-display text-5xl ${scoreColor(last.score)}`}>{last.score}</p>
              <p className="mt-1 text-xs text-muted">
                из 100
                {prev && delta !== 0 && (
                  <span className={delta > 0 ? "ml-2 font-bold text-violet" : "ml-2 font-bold text-red-600"}>
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </span>
                )}
              </p>
              {data.runs.length > 1 && (
                <div className="mt-4 flex h-8 items-end justify-center gap-1" aria-label="История оценки">
                  {[...data.runs].reverse().map((r) => (
                    <div
                      key={r.id}
                      title={`${r.score} · ${new Date(r.ranAt).toLocaleDateString("ru-RU")}`}
                      style={{ height: `${Math.max(8, r.score * 0.32)}px` }}
                      className="w-2 rounded-sm bg-violet/70"
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="py-6 text-sm text-muted">Проверок ещё не было</p>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-white p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              {(["critical", "warning", "info"] as const).map((s) => (
                <span key={s} className={`rounded-full px-3 py-1 ${SEVERITY[s].chip}`}>
                  {SEVERITY[s].label}: {last ? last[s] : 0}
                </span>
              ))}
            </div>
            <button
              onClick={runNow}
              disabled={running}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-extrabold text-ink-900 transition hover:-translate-y-0.5 disabled:opacity-50"
            >
              {running ? "Проверяем сайт…" : "Проверить сейчас"}
            </button>
          </div>
          <p className="text-sm text-muted">
            {last
              ? `Последняя проверка: ${ago(last.ranAt)} (${last.trigger === "cron" ? "по расписанию" : "вручную"}), страниц обойдено: ${last.pagesChecked}.`
              : "Нажмите «Проверить сейчас» — монитор проверит тексты статей, страницы сайта, robots.txt и sitemap."}
          </p>
          {last && !last.networkOk && (
            <p className="mt-2 text-sm text-amber-800">Сервер не смог открыть страницы собственного сайта — проверены только тексты статей.</p>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <p className="mt-3 text-xs text-muted">
            Исправленные замечания закрываются сами при следующей проверке. О новых срочных письмо приходит на ADMIN_NOTIFY_EMAIL, если настроена проверка по расписанию.
          </p>
        </div>
      </div>

      <BotsPanel rows={data.bots ?? []} />
      {data.indexNow && <IndexNowPanel info={data.indexNow} onDone={load} />}

      <div className="mb-4 flex flex-wrap gap-2">
        {([["all", "Все"], ["content", "Контент"], ["technical", "Страницы"], ["indexing", "Индексация"], ["setup", "Подключения"]] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${filter === v ? "bg-ink-900 text-white" : "border border-line text-ink-900 hover:bg-soft"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {active.length === 0 && (
        <p className="rounded-2xl border border-line bg-soft p-6 text-center text-sm text-muted">
          {last ? "Всё в порядке — по этому разделу задач нет." : "Запустите первую проверку, чтобы получить список задач."}
        </p>
      )}

      <div className="space-y-3">
        {active.map((i) => (
          <div key={i.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${SEVERITY[i.severity].dot}`} />
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${SEVERITY[i.severity].chip}`}>{SEVERITY[i.severity].label}</span>
                  <span className="text-[11px] text-muted">{CATEGORY[i.category]}</span>
                </div>
                <p className="font-medium text-ink-900">{i.title}</p>
                {i.detail && <p className="mt-1 text-sm text-muted">{i.detail}</p>}
                <p className="mt-2 text-sm text-ink-900">
                  <span className="mr-1 font-bold text-violet">→ Что сделать:</span>
                  {i.fix}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {i.targetId && (
                  <button onClick={() => onEditPost(i.targetId)} className="rounded-full bg-ink-900 px-3 py-1 text-xs font-medium text-white hover:bg-ink-800">
                    Исправить статью
                  </button>
                )}
                {i.target.startsWith("/") && (
                  <a href={i.target} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-3 py-1 text-xs font-medium hover:bg-soft">
                    Открыть
                  </a>
                )}
                <button onClick={() => act(i.id, "snooze")} className="rounded-full border border-line px-3 py-1 text-xs font-medium hover:bg-soft">
                  Отложить на 7 дн.
                </button>
                <button onClick={() => act(i.id, "ignore")} className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted hover:bg-soft">
                  Игнорировать
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.resolved.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 font-display text-base text-ink-900">Исправлено за 2 недели · {data.resolved.length}</h3>
          <ul className="space-y-1.5 text-sm">
            {data.resolved.map((r) => (
              <li key={r.id} className="flex gap-2 text-muted">
                <span className="text-violet">✓</span>
                <span>{r.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {muted.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowMuted((v) => !v)} className="text-sm font-medium text-violet underline underline-offset-4">
            {showMuted ? "Скрыть" : "Показать"} отложенные и игнорируемые ({muted.length})
          </button>
          {showMuted && (
            <ul className="mt-3 space-y-2">
              {muted.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-soft p-3 text-sm">
                  <span className="min-w-0 text-muted">
                    {i.title}
                    <span className="ml-2 text-[11px]">
                      {i.status === "ignored" ? "· игнорируется" : `· отложено до ${new Date(i.snoozedUntil!).toLocaleDateString("ru-RU")}`}
                    </span>
                  </span>
                  <button onClick={() => act(i.id, "reopen")} className="shrink-0 rounded-full border border-line bg-white px-3 py-1 text-xs font-medium hover:bg-soft">
                    Вернуть
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
