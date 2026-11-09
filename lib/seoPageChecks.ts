import type { RawIssue } from "@/lib/seoAudit";

/**
 * Расширенные проверки страниц по образцу сервисов вроде PR-CY: каноникалы, Open Graph, заголовки, картинки,
 * ссылки, смешанный контент, дубли, битые ссылки, SSL, редиректы, страница 404.
 * Только чистые функции: ничего не читают из базы и сети (сеть — в lib/seoRun.ts), поэтому покрыты тестами.
 */

function issue(p: Pick<RawIssue, "code" | "severity" | "category" | "title" | "fix"> & Partial<RawIssue>): RawIssue {
  return { detail: "", target: "", targetId: "", ...p };
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");

/** Значение атрибута из текста тега; null — атрибута нет */
export function attrOf(tag: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  if (!m) return null;
  return decode(m[1] ?? m[2] ?? m[3] ?? "");
}

// ───────────────────────── разбор HTML ─────────────────────────

export interface LinkInfo {
  href: string | null;
  text: string;
  hasImg: boolean;
  rel: string;
}
export interface ImgInfo {
  src: string;
  /** null — атрибута alt нет вовсе (пустой alt="" допустим для декоративных картинок) */
  alt: string | null;
}
export interface PageDetails {
  titleCount: number;
  title: string;
  description: string;
  canonicals: string[];
  metaRobots: string;
  metaRefresh: boolean;
  h1: string[];
  headings: Record<"h1" | "h2" | "h3" | "h4" | "h5" | "h6", number>;
  og: { title: string; description: string; image: string; url: string };
  links: LinkInfo[];
  imgs: ImgInfo[];
  /** Кодировка из <meta charset> или http-equiv; пусто — не указана */
  metaCharset: string;
  hasLang: boolean;
  hasIcon: boolean;
  words: number;
  textChars: number;
  /** Адреса http:// у картинок, скриптов, стилей и фреймов */
  httpRefs: string[];
}

const stripTags = (s: string) => decode(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

export function extractDetails(html: string): PageDetails {
  const clean = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  const tags = (name: string) => clean.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
  const metas = tags("meta");
  const metaBy = (attr: "name" | "property", key: string) => {
    for (const t of metas) if ((attrOf(t, attr) ?? "").toLowerCase() === key) return (attrOf(t, "content") ?? "").trim();
    return "";
  };

  const titles = clean.match(/<title\b[^>]*>[\s\S]*?<\/title>/gi) ?? [];
  const title = titles[0] ? stripTags(titles[0]) : "";
  const canonicals: string[] = [];
  for (const t of tags("link")) if ((attrOf(t, "rel") ?? "").toLowerCase().split(/\s+/).includes("canonical")) canonicals.push((attrOf(t, "href") ?? "").trim());

  const metaRefresh = metas.some((t) => (attrOf(t, "http-equiv") ?? "").toLowerCase() === "refresh");
  let metaCharset = "";
  for (const t of metas) {
    const c = attrOf(t, "charset");
    if (c) metaCharset = c.toLowerCase();
    else if ((attrOf(t, "http-equiv") ?? "").toLowerCase() === "content-type") {
      const m = /charset=([\w-]+)/i.exec(attrOf(t, "content") ?? "");
      if (m) metaCharset = m[1].toLowerCase();
    }
  }

  const h1: string[] = [];
  for (const m of clean.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)) h1.push(stripTags(m[1]));
  const headings = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  for (const k of Object.keys(headings) as (keyof typeof headings)[]) headings[k] = (clean.match(new RegExp(`<${k}[\\s>]`, "gi")) ?? []).length;

  const links: LinkInfo[] = [];
  for (const m of clean.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const open = `<a ${m[1]}`;
    const text = stripTags(m[2]) || (attrOf(open, "aria-label") ?? "").trim() || (attrOf(open, "title") ?? "").trim();
    links.push({ href: attrOf(open, "href"), text, hasImg: /<img\b/i.test(m[2]) || /<svg\b/i.test(m[2]), rel: (attrOf(open, "rel") ?? "").toLowerCase() });
  }
  const imgs: ImgInfo[] = tags("img").map((t) => ({ src: attrOf(t, "src") ?? attrOf(t, "data-src") ?? "", alt: attrOf(t, "alt") }));

  const httpRefs: string[] = [];
  const isHttp = (u: string | null) => !!u && /^http:\/\//i.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(u);
  for (const name of ["img", "script", "iframe", "source", "video", "audio"]) for (const t of tags(name)) { const s = attrOf(t, "src"); if (isHttp(s)) httpRefs.push(s as string); }
  for (const t of tags("link")) { const rel = (attrOf(t, "rel") ?? "").toLowerCase(); if (/stylesheet|preload|icon/.test(rel)) { const h = attrOf(t, "href"); if (isHttp(h)) httpRefs.push(h as string); } }
  // скрипты вырезаны выше — смотрим исходный HTML, чтобы не пропустить внешние <script src>
  for (const m of html.matchAll(/<script\b[^>]*>/gi)) { const s = attrOf(m[0], "src"); if (isHttp(s) && !httpRefs.includes(s as string)) httpRefs.push(s as string); }

  const body = /<body\b[\s\S]*<\/body>/i.exec(clean)?.[0] ?? clean;
  const text = stripTags(body.replace(/<(nav|header|footer|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " "));
  const words = (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;

  return {
    titleCount: titles.length,
    title,
    description: metaBy("name", "description"),
    canonicals,
    metaRobots: metaBy("name", "robots").toLowerCase(),
    metaRefresh,
    h1,
    headings,
    og: { title: metaBy("property", "og:title"), description: metaBy("property", "og:description"), image: metaBy("property", "og:image"), url: metaBy("property", "og:url") },
    links,
    imgs,
    metaCharset,
    hasLang: /<html\b[^>]*\slang\s*=/i.test(clean),
    hasIcon: tags("link").some((t) => /(^|\s)(shortcut\s+)?icon(\s|$)/i.test(attrOf(t, "rel") ?? "")),
    words,
    textChars: text.length,
    httpRefs,
  };
}

// ───────────────────────── проверки одной страницы ─────────────────────────

export interface PageCtx {
  path: string;
  isPost: boolean;
  targetId: string;
  /** Публичный адрес сайта (https://m-navi.ru) — для проверки canonical и ссылок */
  publicUrl: string;
  contentType: string;
  xRobotsTag: string;
  /** Время до первого байта, мс */
  ttfbMs: number;
  htmlBytes: number;
  /** Адрес, который запрашивали, и адрес, на котором страница в итоге открылась (после редиректов) */
  requestedUrl: string;
  finalUrl: string;
}

const norm = (u: string) => u.replace(/#.*$/, "").replace(/\/+$/, "");

export function auditPageDeep(d: PageDetails, ctx: PageCtx): RawIssue[] {
  const out: RawIssue[] = [];
  const base = { target: ctx.path, targetId: ctx.targetId };
  const where = ctx.path === "/" ? "главная страница" : ctx.path;
  const add = (p: Pick<RawIssue, "code" | "severity" | "category" | "title" | "fix"> & { detail?: string }) => out.push(issue({ ...base, ...p }));
  const pub = new URL(ctx.publicUrl);

  // ── индексация ──
  if (/noindex/i.test(ctx.xRobotsTag)) {
    add({ code: "page.noindex-header", severity: "critical", category: "indexing", title: `Заголовок X-Robots-Tag запрещает индексацию: ${where}`, detail: `Сервер отдаёт X-Robots-Tag: ${ctx.xRobotsTag}.`, fix: "Уберите noindex из заголовков ответа сервера (настройки хостинга или next.config.js)." });
  }
  if (/nofollow/.test(d.metaRobots) || /nofollow/i.test(ctx.xRobotsTag)) {
    add({ code: "page.nofollow", severity: "warning", category: "indexing", title: `Ссылки страницы закрыты от учёта (nofollow): ${where}`, detail: "Мета-тег robots содержит nofollow — поисковик не передаёт вес по ссылкам страницы.", fix: "Уберите nofollow из мета-тега robots, если это не сделано намеренно." });
  }
  if (d.metaRefresh) {
    add({ code: "page.meta-refresh", severity: "warning", category: "indexing", title: `На странице есть мета-перенаправление (meta refresh): ${where}`, detail: "Такой перенаправляющий тег поисковики считают плохой практикой.", fix: "Замените на серверный редирект 301." });
  }
  // Только если запрашивали https, а попали на http: внутренний адрес обхода (http://localhost) сам по себе не ошибка
  if (/^https:\/\//i.test(ctx.requestedUrl) && /^http:\/\//i.test(ctx.finalUrl)) {
    add({ code: "page.redirect-http", severity: "critical", category: "technical", title: `Страница перенаправляет на небезопасный адрес (http): ${where}`, detail: `Итоговый адрес: ${ctx.finalUrl}.`, fix: "Настройте редиректы так, чтобы итоговым был https." });
  }

  // ── canonical ──
  if (d.canonicals.length > 1) {
    const uniq = new Set(d.canonicals.map(norm));
    add({ code: "page.canonical-multiple", severity: "warning", category: "technical", title: `Указано несколько canonical (${d.canonicals.length}): ${where}`, detail: uniq.size > 1 ? "Адреса разные — поисковик проигнорирует их все." : "Адреса одинаковые, но тег должен быть один.", fix: "Оставьте один тег rel=canonical." });
  }
  const c = d.canonicals[0];
  if (c) {
    if (!/^https?:\/\//i.test(c)) {
      add({ code: "page.canonical-relative", severity: "warning", category: "technical", title: `Canonical указан не полным адресом: ${where}`, detail: `Сейчас: ${c}.`, fix: "Укажите абсолютный адрес с https:// и доменом." });
    } else {
      let u: URL | null = null;
      try { u = new URL(c); } catch { /* некорректный адрес ниже считается ошибкой */ }
      if (!u) add({ code: "page.canonical-relative", severity: "warning", category: "technical", title: `Canonical указан некорректно: ${where}`, detail: `Сейчас: ${c}.`, fix: "Укажите абсолютный адрес страницы." });
      else {
        const strip = (h: string) => h.replace(/^www\./, "");
        if (strip(u.host) !== strip(pub.host)) add({ code: "page.canonical-foreign", severity: "critical", category: "technical", title: `Canonical ведёт на другой домен: ${where}`, detail: `Сейчас: ${c}.`, fix: "Canonical должен вести на этот же сайт." });
        else if (u.protocol === "http:" && pub.protocol === "https:") add({ code: "page.canonical-http", severity: "warning", category: "technical", title: `Canonical указывает на http-адрес: ${where}`, detail: `Сейчас: ${c}.`, fix: "Укажите адрес с https." });
      }
    }
  }

  // ── title, description, заголовки ──
  if (d.title && d.title.length < 20) add({ code: "page.title-short", severity: "warning", category: "technical", title: `Слишком короткий title (${d.title.length} симв.): ${where}`, detail: `Сейчас: «${d.title}».`, fix: "Опишите страницу точнее: 30–70 символов с главным запросом." });
  if (d.title.length > 70) add({ code: "page.title-long", severity: "info", category: "technical", title: `Слишком длинный title (${d.title.length} симв.): ${where}`, detail: "Поисковик обрежет заголовок в выдаче.", fix: "Сократите до 70 символов, главное — в начало." });
  if (d.description && d.description.length < 70) add({ code: "page.description-short", severity: "info", category: "technical", title: `Слишком короткое описание (${d.description.length} симв.): ${where}`, fix: "Расширьте описание до 70–170 символов." });
  if (d.description.length > 250) add({ code: "page.description-long", severity: "info", category: "technical", title: `Слишком длинное описание (${d.description.length} симв.): ${where}`, detail: "Часть описания не поместится в сниппет.", fix: "Сократите до 250 символов: Яндекс показывает в сниппете до 250, Google около 160." });
  if (d.h1.length === 1 && d.title && d.h1[0].toLowerCase() === d.title.toLowerCase()) {
    add({ code: "page.h1-equals-title", severity: "info", category: "technical", title: `H1 полностью совпадает с title: ${where}`, detail: "Это упускает возможность охватить больше запросов.", fix: "Сделайте title и H1 похожими по смыслу, но не одинаковыми." });
  }

  // ── Open Graph ──
  const missing = [["og:title", d.og.title], ["og:description", d.og.description], ["og:image", d.og.image], ["og:url", d.og.url]].filter(([, v]) => !v).map(([k]) => k);
  const onlyImageOfPost = ctx.isPost && missing.length === 1 && missing[0] === "og:image"; // для статей это сообщает page.no-og-image
  if (missing.length && !onlyImageOfPost) {
    add({ code: "page.og-incomplete", severity: "warning", category: "technical", title: `Не заполнена базовая разметка Open Graph: ${where}`, detail: `Нет: ${missing.join(", ")}. Ссылка в соцсетях и мессенджерах будет выглядеть бедно.`, fix: "Добавьте недостающие og-теги в metadata страницы (openGraph в layout.tsx или generateMetadata)." });
  }
  if (d.og.url && c && /^https?:\/\//i.test(c) && norm(d.og.url) !== norm(c)) {
    add({ code: "page.og-url-mismatch", severity: "info", category: "technical", title: `og:url не совпадает с canonical: ${where}`, detail: `og:url: ${d.og.url}; canonical: ${c}.`, fix: "Сделайте оба адреса одинаковыми." });
  }

  // ── картинки и ссылки ──
  const noAlt = d.imgs.filter((i) => i.alt === null);
  if (noAlt.length) add({ code: "page.img-no-alt", severity: "warning", category: "technical", title: `Картинки без alt (${noAlt.length}): ${where}`, detail: `Например: ${noAlt.slice(0, 3).map((i) => i.src.slice(0, 60)).join(", ")}.`, fix: "Добавьте описание в alt; у чисто декоративных картинок — пустой alt=\"\"." });
  const noHref = d.links.filter((l) => l.href === null);
  if (noHref.length) add({ code: "page.link-no-href", severity: "info", category: "technical", title: `Ссылки без атрибута href (${noHref.length}): ${where}`, fix: "Добавьте href или замените тег <a> на <button>." });
  const empty = d.links.filter((l) => l.href !== null && !l.text && !l.hasImg);
  if (empty.length) add({ code: "page.link-empty", severity: "info", category: "technical", title: `Ссылки без текста и картинки (${empty.length}): ${where}`, detail: `Например: ${empty.slice(0, 3).map((l) => l.href).join(", ")}.`, fix: "Добавьте видимый текст или aria-label — иначе поисковик не понимает, куда ведёт ссылка." });
  const isInternal = (h: string) => /^\/(?!\/)/.test(h) || (/^https?:\/\//i.test(h) && (() => { try { return new URL(h).host.replace(/^www\./, "") === pub.host.replace(/^www\./, ""); } catch { return false; } })());
  const real = d.links.filter((l) => l.href && !/^(#|mailto:|tel:|javascript:|sms:)/i.test(l.href));
  const dbl = real.filter((l) => /^\/[^/]/.test(l.href as string) ? /\/\//.test(l.href as string) : /^https?:\/\/[^/]+.*\/\//i.test(l.href as string));
  if (dbl.length) add({ code: "page.link-double-slash", severity: "info", category: "technical", title: `Ссылки с двойным слэшем (${dbl.length}): ${where}`, detail: `Например: ${dbl.slice(0, 3).map((l) => l.href).join(", ")}.`, fix: "Уберите лишний «/» в адресах ссылок." });
  const internal = real.filter((l) => isInternal(l.href as string));
  const external = real.filter((l) => !isInternal(l.href as string));
  if (internal.length > 300) add({ code: "page.links-many-internal", severity: "info", category: "technical", title: `Очень много внутренних ссылок (${internal.length}): ${where}`, fix: "Оставьте самые важные ссылки — вес страницы делится между всеми." });
  if (external.length > 50) add({ code: "page.links-many-external", severity: "info", category: "technical", title: `Много внешних ссылок (${external.length}): ${where}`, fix: "Проверьте, нужны ли все; лишние закройте rel=nofollow или уберите." });

  // ── безопасность и вес ──
  if (d.httpRefs.length) add({ code: "page.mixed-content", severity: "warning", category: "technical", title: `Небезопасный контент по http (${d.httpRefs.length}): ${where}`, detail: `Например: ${d.httpRefs.slice(0, 3).join(", ")}. Браузер может заблокировать такие файлы.`, fix: "Подключайте картинки, скрипты и стили по https." });
  if (ctx.htmlBytes > 300 * 1024) add({ code: "page.html-large", severity: "warning", category: "technical", title: `Большой размер HTML (${Math.round(ctx.htmlBytes / 1024)} КБ): ${where}`, detail: "Тяжёлая страница дольше загружается, особенно на телефоне.", fix: "Уберите лишние блоки и встроенные данные, подгружайте тяжёлое по требованию." });
  if (ctx.ttfbMs > 1500) add({ code: "page.server-slow", severity: "warning", category: "technical", title: `Медленный ответ сервера (${(ctx.ttfbMs / 1000).toFixed(1)} с до первого байта): ${where}`, detail: "Сервер долго начинает отдавать страницу.", fix: "Проверьте нагрузку, запросы к базе и кэширование; повторите проверку — единичный всплеск не страшен." });

  // ── контент и кодировка ──
  if (!ctx.isPost && ctx.path !== "/blog" && d.words < 200) add({ code: "page.thin-text", severity: "info", category: "content", title: `Мало текста на странице (${d.words} слов): ${where}`, detail: "Поисковику не хватает материала, чтобы понять тему страницы.", fix: "Добавьте полезный текст: от 250 слов по теме страницы." });
  const headerCharset = /charset=([\w-]+)/i.exec(ctx.contentType)?.[1]?.toLowerCase() ?? "";
  const utf = (s: string) => /^utf-?8$/.test(s);
  if ((headerCharset && !utf(headerCharset)) || (d.metaCharset && !utf(d.metaCharset)) || (!headerCharset && !d.metaCharset)) {
    add({ code: "page.encoding", severity: "warning", category: "technical", title: `Кодировка страницы не UTF-8 или не указана: ${where}`, detail: `В заголовке: ${headerCharset || "нет"}; в HTML: ${d.metaCharset || "нет"}.`, fix: "Укажите UTF-8 и в заголовке Content-Type, и в <meta charset>." });
  }
  if (!d.hasLang) add({ code: "page.no-lang", severity: "info", category: "technical", title: `Не указан язык страницы (lang): ${where}`, fix: "Добавьте lang=\"ru\" в тег <html>." });
  return out;
}

// ───────────────────────── дубли на разных страницах ─────────────────────────

export interface DupPage {
  path: string;
  title: string;
  description: string;
  h1: string;
  noindex: boolean;
}

export function auditDuplicates(pages: DupPage[]): RawIssue[] {
  const out: RawIssue[] = [];
  const live = pages.filter((p) => !p.noindex);
  const groups = (pick: (p: DupPage) => string) => {
    const m = new Map<string, string[]>();
    for (const p of live) {
      const v = pick(p).trim().toLowerCase();
      if (v) m.set(v, [...(m.get(v) ?? []), p.path]);
    }
    return Array.from(m.values()).filter((g) => g.length > 1).map((g) => g.sort());
  };
  const spec: [string, (p: DupPage) => string, string, string][] = [
    ["page.dup-title", (p) => p.title, "title", "Сделайте title у каждой страницы уникальным."],
    ["page.dup-description", (p) => p.description, "description", "Напишите уникальное описание для каждой страницы."],
    ["page.dup-h1", (p) => p.h1, "заголовок H1", "Сделайте H1 у каждой страницы уникальным."],
  ];
  for (const [code, pick, label, fix] of spec) {
    for (const g of groups(pick)) {
      out.push(issue({ code, severity: "warning", category: "technical", target: g[0], title: `Повторяется ${label} на ${g.length} страницах`, detail: `Страницы: ${g.slice(0, 6).join(", ")}${g.length > 6 ? " и др." : ""}.`, fix }));
    }
  }
  return out;
}

// ───────────────────────── битые внутренние ссылки ─────────────────────────

/** Уникальные внутренние ссылки со всех страниц: путь → где найдена */
export function collectInternalLinks(pages: { path: string; links: LinkInfo[] }[], publicUrl: string): Map<string, string[]> {
  const host = new URL(publicUrl).host.replace(/^www\./, "");
  const found = new Map<string, string[]>();
  for (const p of pages) {
    for (const l of p.links) {
      if (!l.href || /^(#|mailto:|tel:|javascript:|sms:)/i.test(l.href)) continue;
      let u: URL;
      try { u = new URL(l.href, publicUrl + p.path); } catch { continue; }
      if (!/^https?:$/.test(u.protocol) || u.host.replace(/^www\./, "") !== host) continue;
      if (/^\/(api|_next)\//.test(u.pathname)) continue;
      const path = (u.pathname.replace(/\/+$/, "") || "/") + u.search;
      const from = found.get(path) ?? [];
      if (!from.includes(p.path)) from.push(p.path);
      found.set(path, from);
    }
  }
  return found;
}

export function auditBrokenLinks(checked: { path: string; status: number; from: string[] }[]): RawIssue[] {
  return checked
    .filter((c) => c.status === 404 || c.status === 410)
    .map((c) =>
      issue({
        code: "page.broken-link",
        severity: "warning",
        category: "technical",
        target: c.path,
        title: `Битая внутренняя ссылка (код ${c.status}): ${c.path}`,
        detail: `Ссылка найдена на страницах: ${c.from.slice(0, 5).join(", ")}${c.from.length > 5 ? " и др." : ""}.`,
        fix: "Исправьте адрес ссылки или верните страницу; если страница удалена — уберите ссылку.",
      })
    );
}

// ───────────────────────── проверки сайта в целом ─────────────────────────

export interface SiteTechInput {
  /** Срок действия SSL-сертификата; null — проверить не удалось */
  sslExpiresAt: Date | null;
  /** Причина, если сертификат недействителен */
  sslError: string;
  /** Ответ на www-адрес без следования редиректам; null — не открылся */
  www: { status: number; location: string } | null;
  /** Ответ на http-адрес без следования редиректам; null — не открылся */
  http: { status: number; location: string } | null;
  /** Ответ на заведомо несуществующий адрес */
  notFound: { status: number; html: string } | null;
  favicon: { status: number } | null;
  homeHasIconLink: boolean;
  publicUrl: string;
}

export function auditSiteTech(s: SiteTechInput, now: Date): RawIssue[] {
  const out: RawIssue[] = [];
  const host = new URL(s.publicUrl).host.replace(/^www\./, "");
  const redirectOk = (r: { status: number; location: string }, wantHost: string, wantHttps: boolean) => {
    if (![301, 308].includes(r.status)) return false;
    try { const u = new URL(r.location, `http://${wantHost}`); return u.host === wantHost && (!wantHttps || u.protocol === "https:"); } catch { return false; }
  };

  if (s.sslError) {
    out.push(issue({ code: "site.ssl-invalid", severity: "critical", category: "technical", title: "SSL-сертификат сайта недействителен", detail: s.sslError, fix: "Перевыпустите сертификат в Timeweb (раздел доменов приложения) — иначе браузеры покажут предупреждение." }));
  } else if (s.sslExpiresAt) {
    const days = Math.floor((s.sslExpiresAt.getTime() - now.getTime()) / 86400000);
    if (days < 7) out.push(issue({ code: "site.ssl-expiring", severity: "critical", category: "technical", title: `SSL-сертификат истекает через ${Math.max(days, 0)} дн.`, detail: `Действует до ${s.sslExpiresAt.toLocaleDateString("ru-RU")}.`, fix: "Проверьте автообновление сертификата в Timeweb; при необходимости перевыпустите вручную." }));
    else if (days < 21) out.push(issue({ code: "site.ssl-expiring", severity: "warning", category: "technical", title: `SSL-сертификат истекает через ${days} дн.`, detail: `Действует до ${s.sslExpiresAt.toLocaleDateString("ru-RU")}.`, fix: "Обычно сертификат обновляется сам за 7 дней до конца; проверьте это в Timeweb." }));
  }
  if (s.www && !redirectOk(s.www, host, true)) {
    out.push(issue({ code: "site.www-redirect", severity: "warning", category: "technical", title: "Адрес с www не перенаправляет на основной", detail: `Ответ на www.${host}: код ${s.www.status}${s.www.location ? `, Location: ${s.www.location}` : ""}.`, fix: "Настройте постоянный редирект (301) с www на адрес без www и добавьте www в DNS и в домены приложения." }));
  }
  if (s.http && !redirectOk(s.http, host, true) && !redirectOk(s.http, `www.${host}`, true)) {
    out.push(issue({ code: "site.http-redirect", severity: "warning", category: "technical", title: "Адрес с http не перенаправляет на https", detail: `Ответ на http://${host}: код ${s.http.status}.`, fix: "Включите принудительный редирект на https в настройках домена Timeweb." }));
  }
  if (s.notFound) {
    if (s.notFound.status !== 404) {
      out.push(issue({ code: "site.404-status", severity: "critical", category: "indexing", title: `Несуществующая страница отвечает кодом ${s.notFound.status}, а не 404`, detail: "Поисковик может принять пустые адреса за настоящие страницы («мягкая 404»).", fix: "Настройте отдачу кода 404 для несуществующих адресов." }));
    } else if (!/href\s*=\s*["']\/["']/i.test(s.notFound.html)) {
      out.push(issue({ code: "site.404-no-link", severity: "warning", category: "technical", title: "На странице 404 нет ссылки на главную", fix: "Добавьте на страницу 404 ссылку на главную и основные разделы." }));
    }
  }
  if (s.favicon && s.favicon.status !== 200 && !s.homeHasIconLink) {
    out.push(issue({ code: "site.no-favicon", severity: "warning", category: "technical", title: "У сайта нет favicon", detail: "Иконка показывается во вкладке и в выдаче Яндекса.", fix: "Добавьте favicon.ico или <link rel=\"icon\"> в layout." }));
  }
  return out;
}
