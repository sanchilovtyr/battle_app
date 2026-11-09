import type { RawIssue } from "@/lib/seoAudit";

/** Скорость загрузки по данным Google PageSpeed Insights (Lighthouse): оценка 0–100, LCP, CLS, FCP, TBT, ответ сервера */

export type PsiStrategy = "mobile" | "desktop";

export interface PsiResult {
  strategy: PsiStrategy;
  /** 0–100; null — не удалось получить */
  score: number | null;
  /** мс */
  fcp: number | null;
  lcp: number | null;
  tbt: number | null;
  ttfb: number | null;
  /** безразмерная величина (хорошо ≤ 0.1, плохо > 0.25) */
  cls: number | null;
  error: string;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parsePsi(data: any, strategy: PsiStrategy): PsiResult {
  const lh = data?.lighthouseResult;
  const a = lh?.audits ?? {};
  const s = num(lh?.categories?.performance?.score);
  return {
    strategy,
    score: s === null ? null : Math.round(s * 100),
    fcp: num(a["first-contentful-paint"]?.numericValue),
    lcp: num(a["largest-contentful-paint"]?.numericValue),
    tbt: num(a["total-blocking-time"]?.numericValue),
    ttfb: num(a["server-response-time"]?.numericValue),
    cls: num(a["cumulative-layout-shift"]?.numericValue),
    error: s === null ? String(data?.error?.message ?? "Нет данных в ответе PageSpeed").slice(0, 200) : "",
  };
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export async function fetchPsi(url: string, strategy: PsiStrategy, key: string | undefined, fetchFn: FetchFn = fetch, timeoutMs = 40000): Promise<PsiResult> {
  const api = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance${key ? `&key=${encodeURIComponent(key)}` : ""}`;
  try {
    const res = await fetchFn(api, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const quota = res.status === 429 || /quota/i.test(String(data?.error?.message ?? ""));
      return { ...parsePsi(null, strategy), error: quota ? "Лимит запросов PageSpeed исчерпан — задайте PAGESPEED_API_KEY (бесплатный ключ Google)" : `PageSpeed ответил ${res.status}` };
    }
    return parsePsi(data, strategy);
  } catch (e) {
    return { ...parsePsi(null, strategy), error: e instanceof Error && e.name === "TimeoutError" ? "PageSpeed не ответил вовремя" : "Не удалось обратиться к PageSpeed" };
  }
}

export function auditPsi(results: PsiResult[]): RawIssue[] {
  const out: RawIssue[] = [];
  const mk = (p: Pick<RawIssue, "code" | "severity" | "title" | "fix"> & { detail?: string }) =>
    out.push({ category: "technical", detail: "", target: "/", targetId: "", ...p });
  for (const r of results) {
    if (r.score === null) continue;
    const who = r.strategy === "mobile" ? "с телефона" : "с компьютера";
    if (r.score < 90) {
      mk({
        code: `psi.${r.strategy}-score`,
        severity: r.score < 50 ? "critical" : "warning",
        title: `Скорость загрузки ${who}: ${r.score} из 100`,
        detail: `По данным Google PageSpeed. LCP ${fmtSec(r.lcp)}, FCP ${fmtSec(r.fcp)}, сдвиг макета ${fmtCls(r.cls)}, блокировка ${r.tbt === null ? "—" : Math.round(r.tbt) + " мс"}.`,
        fix: "Уменьшите тяжёлые скрипты и картинки, отложите загрузку второстепенного. Подробности — в отчёте PageSpeed Insights для главной.",
      });
    }
    if (r.cls !== null && r.cls > 0.1) {
      mk({
        code: `psi.${r.strategy}-cls`,
        severity: r.cls > 0.25 ? "warning" : "info",
        title: `Смещение макета при загрузке ${who}: ${fmtCls(r.cls)}`,
        detail: "Элементы страницы «прыгают» во время загрузки (шрифты, картинки, блоки без заданной высоты). Норма — до 0,1.",
        fix: "Задайте размеры картинок и блоков заранее, подключайте шрифты с font-display и резервом места, не вставляйте блоки над уже видимым контентом.",
      });
    }
    if (r.lcp !== null && r.lcp > 2500) {
      mk({
        code: `psi.${r.strategy}-lcp`,
        severity: r.lcp > 4000 ? "warning" : "info",
        title: `Медленно отрисовывается главный блок ${who}: ${fmtSec(r.lcp)}`,
        detail: "Норма — до 2,5 с.",
        fix: "Ускорьте загрузку главной картинки и заголовка: меньше вес, быстрее ответ сервера, меньше блокирующих скриптов.",
      });
    }
    if (r.tbt !== null && r.tbt > 600) {
      mk({
        code: `psi.${r.strategy}-tbt`,
        severity: "info",
        title: `Скрипты надолго блокируют страницу ${who}: ${Math.round(r.tbt)} мс`,
        detail: "Норма — до 200 мс.",
        fix: "Отложите загрузку счётчиков и вебвизора, уменьшите объём JavaScript.",
      });
    }
  }
  return out;
}

export const fmtSec = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1).replace(".", ",")} с`);
export const fmtCls = (v: number | null) => (v === null ? "—" : v.toFixed(2).replace(".", ","));
