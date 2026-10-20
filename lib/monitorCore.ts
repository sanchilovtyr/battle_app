// Чистые функции мониторинга внешних угроз (без сети и базы — проверяются в scripts/seo_test.ts):
//  • разбор RSS и Atom лент;
//  • снимок текста страницы конкурента и сравнение со вчерашним;
//  • правило robots.txt;
//  • подбор свежих новостей под угрозу по ключевым словам.
//
// Всё это — подсказки «посмотрите сами»: сервис не оценивает, что важно, и не делает выводов о конкурентах.

export const MAX_COMPETITORS_PER_BUSINESS = 3;
export const MAX_SNAPSHOT_CHARS = 40_000;
export const MAX_SNAPSHOT_LINES = 500;
export const NEWS_KEEP_DAYS = 60;
export const NEWS_SHOW_DAYS = 45;
/** Не проверять один и тот же сайт чаще, чем раз в столько часов (ручной запуск — реже, см. MANUAL_COOLDOWN_MIN). */
export const CHECK_EVERY_HOURS = 20;
export const MANUAL_COOLDOWN_MIN = 30;

// ───────────────────────── текст ─────────────────────────

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…", rub: "₽", copy: "©" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, g: string) => {
    if (g[0] === "#") {
      const code = g[1].toLowerCase() === "x" ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return " ";
      try {
        return String.fromCodePoint(code);
      } catch {
        return " ";
      }
    }
    return NAMED[g.toLowerCase()] ?? m;
  });
}

const clean = (s: string): string => decodeEntities(s).replace(/\s+/g, " ").trim();

function stripTags(s: string): string {
  const once = clean(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, " "));
  // Многие ленты кладут HTML в описание в виде &lt;p&gt;…: после раскодирования разметку убираем ещё раз
  return /<\/?[a-z][^>]*>/i.test(once) ? clean(once.replace(/<[^>]*>/g, " ")) : once;
}

const norm = (s: string): string => s.toLowerCase().replace(/ё/g, "е");

// ───────────────────────── ленты ─────────────────────────

export interface FeedItem {
  title: string;
  link: string;
  summary: string;
  publishedAt: Date;
}

function tagText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1] : "";
}

function parseDate(raw: string, fallback: Date): Date {
  const t = raw.trim();
  if (!t) return fallback;
  const d = new Date(t);
  return Number.isFinite(d.getTime()) ? d : fallback;
}

/** RSS 2.0 и Atom. Записи без заголовка или ссылки пропускаются. Не больше 100 свежих. */
export function parseFeed(xml: string, now: Date): FeedItem[] {
  const out: FeedItem[] = [];
  const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const blocks = isAtom ? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [] : xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const title = stripTags(tagText(block, "title")).slice(0, 300);
    let link = "";
    if (isAtom) {
      const alt = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*>/i) || block.match(/<link\b[^>]*>/i);
      link = alt ? (alt[0].match(/href=["']([^"']+)["']/i)?.[1] ?? "") : "";
    } else {
      link = clean(tagText(block, "link").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
      if (!link) link = clean(tagText(block, "guid")).startsWith("http") ? clean(tagText(block, "guid")) : "";
    }
    link = decodeEntities(link).trim();
    if (!title || !/^https?:\/\//i.test(link) || link.length > 1000) continue;
    const summaryRaw = isAtom ? tagText(block, "summary") || tagText(block, "content") : tagText(block, "description") || tagText(block, "content:encoded");
    const dateRaw = isAtom ? tagText(block, "published") || tagText(block, "updated") : tagText(block, "pubDate") || tagText(block, "dc:date");
    let when = parseDate(stripTags(dateRaw), now);
    if (when.getTime() > now.getTime() + 24 * 3600 * 1000) when = now; // даты «из будущего» не доверяем
    out.push({ title, link, summary: stripTags(summaryRaw).slice(0, 400), publishedAt: when });
  }
  return out.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()).slice(0, 100);
}

// ───────────────────────── страница конкурента ─────────────────────────

export interface PageSnapshot {
  title: string;
  lines: string[];
}

const BLOCK_TAGS = "p|div|section|article|li|ul|ol|tr|td|th|h[1-6]|br|header|footer|nav|main|aside|form|table|blockquote|dd|dt|figcaption|button|a";

/** Текст страницы построчно: заголовок, описание, видимый текст. Без скриптов, стилей и служебных строк. */
export function pageSnapshot(html: string): PageSnapshot {
  const title = clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/<[^>]*>/g, " ")).slice(0, 200);
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]*>/i)?.[0].match(/content=["']([^"']*)["']/i)?.[1];
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|template|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), "\n")
    .replace(/<[^>]*>/g, " ");
  const raw = [title, metaDesc ? clean(metaDesc) : "", ...decodeEntities(body).split(/\n+/)];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const l of raw) {
    const line = l.replace(/\s+/g, " ").trim();
    if (line.length < 4 || line.length > 400) continue;
    if (!isMeaningfulLine(line)) continue;
    const key = norm(line);
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(line);
    if (lines.length >= MAX_SNAPSHOT_LINES) break;
  }
  return { title, lines };
}

const PRICE_RE = /(?:₽|руб|р\.|\$|€|usd|eur)/i;

/** Строка, которая может быть содержательной: есть буквы, либо это цена. Только цифры, даты и время — шум. */
export function isMeaningfulLine(line: string): boolean {
  if (/^[\d\s.,:;\-–—/\\|()+%№#*]+$/.test(line)) return false;
  if (/^(?:©|copyright)\b/i.test(line)) return false;
  if (/^\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(line) && line.length < 20) return false;
  if (/^\d{1,2}:\d{2}/.test(line) && line.length < 12) return false;
  if (/[a-zа-яё]/i.test(line)) return true;
  return PRICE_RE.test(line) && /\d/.test(line);
}

export function snapshotToText(lines: string[]): string {
  let text = lines.join("\n");
  if (text.length > MAX_SNAPSHOT_CHARS) text = text.slice(0, MAX_SNAPSHOT_CHARS);
  return text;
}

export function textToLines(text: string | null | undefined): string[] {
  return (text ?? "").split("\n").filter(Boolean);
}

export interface PageDiff {
  added: string[];
  removed: string[];
  /** Изменилась бóльшая часть страницы: вероятно, редизайн или динамический блок, а не точечная правка. */
  large: boolean;
}

const MAX_DIFF_LINES = 15;
const cut = (s: string) => (s.length > 220 ? s.slice(0, 217) + "…" : s);

/** Что добавилось и что пропало на странице. null — значимых изменений нет. */
export function diffLines(prev: string[], next: string[]): PageDiff | null {
  const prevSet = new Set(prev.map(norm));
  const nextSet = new Set(next.map(norm));
  const added = next.filter((l) => !prevSet.has(norm(l)));
  const removed = prev.filter((l) => !nextSet.has(norm(l)));
  if (added.length === 0 && removed.length === 0) return null;
  const base = Math.max(prev.length, next.length, 1);
  return {
    added: added.slice(0, MAX_DIFF_LINES).map(cut),
    removed: removed.slice(0, MAX_DIFF_LINES).map(cut),
    large: (added.length + removed.length) / base > 0.6,
  };
}

// ───────────────────────── robots.txt ─────────────────────────

/** Можно ли нашему роботу открыть путь: учитываются группы User-agent (наша и «*»), самое длинное совпадающее правило побеждает. */
export function robotsAllows(robotsTxt: string, path: string, agent = "keywordmonitor"): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && cur) {
      lastWasAgent = false;
      cur.rules.push({ allow: key === "allow", path: value });
    } else {
      lastWasAgent = false;
    }
  }
  const mine = groups.filter((g) => g.agents.some((a) => a !== "*" && agent.includes(a) && a.length > 0));
  const pool = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  let best: { allow: boolean; len: number } | null = null;
  for (const g of pool) {
    for (const r of g.rules) {
      if (r.path === "") continue; // пустой Disallow = разрешено всё
      const pattern = r.path.endsWith("$") ? r.path.slice(0, -1) : r.path;
      const re = new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + (r.path.endsWith("$") ? "$" : ""));
      if (re.test(path)) {
        const len = r.path.length;
        if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
      }
    }
  }
  return best ? best.allow : true;
}

// ───────────────────────── подбор новостей ─────────────────────────

export function parseKeywords(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .split(/[,;\n]+/)
    .map((k) => norm(k).trim())
    .filter((k) => k.length >= 3 && k.length <= 40)
    .slice(0, 12);
}

/** Ключевое слово совпадает с началом слова (так «поставк» ловит «поставки», «поставкам», а «закон» не цепляет «заканчивать»). */
export function textMatches(text: string, keywords: string[]): string[] {
  const hay = " " + norm(text).replace(/[^a-zа-я0-9]+/g, " ");
  const found: string[] = [];
  for (const k of keywords) {
    const needle = " " + norm(k).replace(/[^a-zа-я0-9 ]+/g, " ").trim();
    if (needle.trim().length >= 3 && hay.includes(needle)) found.push(k);
  }
  return found;
}

export interface NewsLike {
  id: string;
  title: string;
  summary?: string;
  publishedAt: string | Date;
}

/** Новости, где встретилось хотя бы одно ключевое слово; больше совпадений и свежее — выше. */
export function matchNews<T extends NewsLike>(items: T[], keywords: string[], limit = 5): (T & { matched: string[] })[] {
  if (keywords.length === 0) return [];
  const hits: (T & { matched: string[] })[] = [];
  for (const it of items) {
    const matched = textMatches(`${it.title} ${it.summary ?? ""}`, keywords);
    if (matched.length) hits.push({ ...it, matched });
  }
  return hits
    .sort((a, b) => b.matched.length - a.matched.length || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}
