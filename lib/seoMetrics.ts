import { prisma } from "@/lib/db";

// SeoMetric появилась после последней генерации клиента Prisma — обращаемся через any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export interface SiteMetrics {
  at: string;
  pagesChecked: number;
  /** среднее время ответа страницы целиком, мс */
  avgMs: number | null;
  /** среднее время до первого байта, мс */
  avgTtfb: number | null;
  /** средний размер HTML, КБ */
  avgHtmlKb: number | null;
  sslExpiresAt: string | null;
  linksChecked: number;
}

export interface PsiMetrics {
  at: string;
  mobile: import("@/lib/pageSpeed").PsiResult | null;
  desktop: import("@/lib/pageSpeed").PsiResult | null;
}

export interface WebmasterMetrics {
  at: string;
  sqi: number | null;
  searchablePages: number | null;
  excludedPages: number | null;
  problems: { code: string; severity: string; state: string }[];
  error: string;
}

export async function saveMetric(key: "site" | "psi" | "webmaster", value: unknown): Promise<void> {
  try {
    const json = JSON.stringify(value);
    await db.seoMetric.upsert({ where: { key }, create: { key, json }, update: { json, updatedAt: new Date() } });
  } catch (e) {
    console.error("SEO-монитор: не удалось сохранить метрику (нужен prisma db push?)", key, e);
  }
}

export async function loadMetrics(): Promise<{ site: SiteMetrics | null; psi: PsiMetrics | null; webmaster: WebmasterMetrics | null; tableMissing: boolean }> {
  try {
    const rows = (await db.seoMetric.findMany()) as { key: string; json: string }[];
    const get = (k: string) => {
      const r = rows.find((x) => x.key === k);
      if (!r) return null;
      try { return JSON.parse(r.json); } catch { return null; }
    };
    return { site: get("site"), psi: get("psi"), webmaster: get("webmaster"), tableMissing: false };
  } catch {
    return { site: null, psi: null, webmaster: null, tableMissing: true };
  }
}
