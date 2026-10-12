import { BOTS } from "@/lib/bots";
import { wordCount } from "@/lib/blog";

/**
 * SEO-монитор: движок проверок. Состоит из чистых функций (их легко тестировать —
 * они ничего не читают из базы и сети) и оркестратора runSeoAudit, который собирает
 * данные, прогоняет проверки и синхронизирует результат с таблицей SeoIssue.
 */

export type Severity = "critical" | "warning" | "info";
export type Category = "content" | "technical" | "indexing" | "setup";

export interface RawIssue {
  code: string;
  severity: Severity;
  category: Category;
  title: string;
  detail: string;
  fix: string;
  /** slug статьи или путь страницы */
  target: string;
  targetId: string;
}

export interface AuditPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverAlt: string;
  hasCover: boolean;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  /** Автор статьи; пусто — не указан */
  authorName?: string;
  /** Когда статью последний раз отправляли в IndexNow */
  indexNowAt?: Date | null;
  published: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DAY = 24 * 60 * 60 * 1000;

function issue(
  p: Partial<RawIssue> & Pick<RawIssue, "code" | "severity" | "category" | "title" | "fix">
): RawIssue {
  return { detail: "", target: "", targetId: "", ...p };
}

const isLive = (p: AuditPost, now: Date) => p.published && p.publishedAt !== null && p.publishedAt <= now;

// ───────────────────────── проверки текста одной статьи ─────────────────────────

export function auditPostContent(post: AuditPost, now: Date): RawIssue[] {
  if (!isLive(post, now)) return [];
  const out: RawIssue[] = [];
  const base = { target: post.slug, targetId: post.id };
  const name = `«${post.title}»`;

  const title = post.metaTitle || post.title;
  const desc = post.metaDescription || post.excerpt;
  const kws = post.keywords.map((k) => k.toLowerCase());
  const main = kws[0];
  const words = wordCount(post.body);
  const firstPara = post.body.trim().split(/\n\s*\n/)[0]?.toLowerCase() ?? "";

  if (title.length < 30 || title.length > 65) {
    out.push(
      issue({
        ...base,
        code: "post.title-length",
        severity: "warning",
        category: "content",
        title: `Заголовок для поиска неудачной длины: ${name}`,
        detail: `Сейчас ${title.length} символов, оптимально 30–65 — иначе поисковик обрежет заголовок в выдаче или он будет слишком скромным.`,
        fix: "Откройте статью и поправьте поле Title (или заголовок).",
      })
    );
  }

  if (!desc.trim()) {
    out.push(
      issue({
        ...base,
        code: "post.no-description",
        severity: "warning",
        category: "content",
        title: `Нет описания (description): ${name}`,
        detail: "Без описания поисковик подставит случайный кусок текста, и сниппет в выдаче будет слабее.",
        fix: "Заполните «Краткое описание» или поле Description — 70–170 символов с ключевой фразой.",
      })
    );
  } else if (desc.length < 70 || desc.length > 170) {
    out.push(
      issue({
        ...base,
        code: "post.description-length",
        severity: "info",
        category: "content",
        title: `Описание неудачной длины: ${name}`,
        detail: `Сейчас ${desc.length} символов, оптимально 70–170.`,
        fix: "Подправьте Description так, чтобы он помещался в сниппет и продавал клик.",
      })
    );
  }

  if (!post.hasCover) {
    out.push(
      issue({
        ...base,
        code: "post.no-cover",
        severity: "warning",
        category: "content",
        title: `Нет обложки: ${name}`,
        detail: "Без картинки статья хуже выглядит в соцсетях и в превью ссылок, снижается кликабельность.",
        fix: "Загрузите обложку 1200×630 и заполните alt-текст.",
      })
    );
  } else if (!post.coverAlt.trim()) {
    out.push(
      issue({
        ...base,
        code: "post.no-alt",
        severity: "info",
        category: "content",
        title: `У обложки нет alt-текста: ${name}`,
        detail: "Alt нужен для доступности и для поиска по картинкам.",
        fix: "Опишите, что изображено на обложке, одной фразой — желательно с ключевым словом.",
      })
    );
  }

  if (!(post.authorName ?? "").trim()) {
    out.push(
      issue({
        ...base,
        code: "post.no-author",
        severity: "info",
        category: "content",
        title: `Не указан автор: ${name}`,
        detail: "Яндекс в справке по ЭПОС советует показывать автора и его квалификацию: статья без автора выглядит менее надёжной.",
        fix: "Заполните блок «Автор» в редакторе статьи: имя, должность или опыт, 1–2 предложения об авторе.",
      })
    );
  }

  if (words < 300) {
    out.push(
      issue({
        ...base,
        code: "post.thin",
        severity: "warning",
        category: "content",
        title: `Слишком короткая статья: ${name}`,
        detail: `Всего ${words} слов. Такие тексты редко попадают в топ — поисковик считает их неполным ответом.`,
        fix: "Дополните статью до 600+ слов: примеры, цифры, разбор частых вопросов.",
      })
    );
  } else if (words < 600) {
    out.push(
      issue({
        ...base,
        code: "post.short",
        severity: "info",
        category: "content",
        title: `Статью можно расширить: ${name}`,
        detail: `${words} слов. Для конкурентных запросов обычно нужно 600–1500.`,
        fix: "Добавьте раздел с примерами или ответами на вопросы читателей.",
      })
    );
  }

  if (!/^##\s+/m.test(post.body)) {
    out.push(
      issue({
        ...base,
        code: "post.no-headings",
        severity: "info",
        category: "content",
        title: `Нет подзаголовков: ${name}`,
        detail: "Структура из подзаголовков помогает и читателям, и поисковику понять, о чём разделы.",
        fix: "Разбейте текст на разделы через «## Подзаголовок», включив в часть из них ключевые слова.",
      })
    );
  }

  if (kws.length === 0) {
    out.push(
      issue({
        ...base,
        code: "post.no-keywords",
        severity: "warning",
        category: "content",
        title: `Не указаны ключевые слова: ${name}`,
        detail: "Без главного запроса непонятно, под что оптимизирована статья, и невозможно проверить её по чеклисту.",
        fix: "Впишите 2–5 ключевых фраз; первая — главный запрос статьи.",
      })
    );
  } else {
    if (!title.toLowerCase().includes(main)) {
      out.push(
        issue({
          ...base,
          code: "post.kw-not-in-title",
          severity: "info",
          category: "content",
          title: `Главного запроса нет в заголовке: ${name}`,
          detail: `Запрос «${main}» не встречается в Title/заголовке.`,
          fix: "Включите главный запрос в заголовок — ближе к началу.",
        })
      );
    }
    if (!firstPara.includes(main)) {
      out.push(
        issue({
          ...base,
          code: "post.kw-not-in-intro",
          severity: "info",
          category: "content",
          title: `Главного запроса нет в первом абзаце: ${name}`,
          detail: `Запрос «${main}» не встречается во вступлении.`,
          fix: "Упомяните главный запрос естественно в первых двух предложениях.",
        })
      );
    }
  }

  if (!/\]\((\/|https?:\/\/(www\.)?m-navi\.ru)/i.test(post.body)) {
    out.push(
      issue({
        ...base,
        code: "post.no-internal-links",
        severity: "info",
        category: "content",
        title: `Нет внутренних ссылок: ${name}`,
        detail: "Внутренние ссылки передают вес между страницами и ведут читателя к анкете.",
        fix: "Добавьте ссылку на анкету «[построить план](/#wizard)» или на другую статью блога.",
      })
    );
  }

  const updated = Math.max(post.updatedAt.getTime(), post.publishedAt?.getTime() ?? 0);
  if (now.getTime() - updated > 365 * DAY) {
    out.push(
      issue({
        ...base,
        code: "post.stale",
        severity: "info",
        category: "content",
        title: `Статья давно не обновлялась: ${name}`,
        detail: "Больше года без правок — цифры и советы могли устареть, а свежесть учитывается в ранжировании.",
        fix: "Перечитайте, обновите данные и пересохраните статью.",
      })
    );
  }

  return out;
}

// ───────────────────────── проверки блога в целом ─────────────────────────

export function auditPortfolio(posts: AuditPost[], now: Date): RawIssue[] {
  const out: RawIssue[] = [];
  const live = posts.filter((p) => isLive(p, now));

  if (live.length === 0) {
    out.push(
      issue({
        code: "blog.empty",
        severity: "warning",
        category: "content",
        title: "В блоге нет опубликованных статей",
        detail: "Пока блог пуст, он не приводит поисковый трафик.",
        fix: "Напишите и опубликуйте первую статью — вкладка «Блог (SEO)».",
        target: "/blog",
      })
    );
  } else {
    if (live.length < 5) {
      out.push(
        issue({
          code: "blog.few",
          severity: "info",
          category: "content",
          title: `В блоге всего ${live.length} из 5+ статей`,
          detail: "Поисковики охотнее показывают сайт, который раскрывает тему широко, а не одной-двумя заметками.",
          fix: "Составьте план из 5–10 статей по запросам из вашей семантики и публикуйте по расписанию.",
          target: "/blog",
        })
      );
    }

    const last = Math.max(...live.map((p) => p.publishedAt!.getTime()));
    const days = Math.floor((now.getTime() - last) / DAY);
    if (days > 45) {
      out.push(
        issue({
          code: "blog.cadence",
          severity: "critical",
          category: "content",
          title: `Блог не обновлялся ${days} дн.`,
          detail: "Долгая тишина сигнализирует поисковикам, что сайт заброшен, и трафик постепенно падает.",
          fix: "Опубликуйте новую статью сегодня и поставьте в отложенную публикацию ещё 2–3 вперёд.",
          target: "/blog",
        })
      );
    } else if (days > 14) {
      out.push(
        issue({
          code: "blog.cadence",
          severity: "warning",
          category: "content",
          title: `Последняя статья вышла ${days} дн. назад`,
          detail: "Оптимально публиковать минимум раз в 2 недели.",
          fix: "Запланируйте новую статью — отложенная публикация выйдет сама.",
          target: "/blog",
        })
      );
    }
  }

  for (const p of posts) {
    if (!p.published && now.getTime() - p.createdAt.getTime() > 14 * DAY && now.getTime() - p.updatedAt.getTime() > 14 * DAY) {
      out.push(
        issue({
          code: "post.draft-stale",
          severity: "info",
          category: "content",
          title: `Черновик лежит без движения: «${p.title}»`,
          detail: "Больше двух недель без правок. Готовый материал приносит трафик, только когда опубликован.",
          fix: "Доработайте и опубликуйте, либо удалите, если тема не актуальна.",
          target: p.slug,
          targetId: p.id,
        })
      );
    }
  }

  // Дубли заголовков и описаний; два материала под один главный запрос (каннибализация)
  const group = (keyOf: (p: AuditPost) => string) => {
    const m = new Map<string, AuditPost[]>();
    for (const p of live) {
      const k = keyOf(p).trim().toLowerCase();
      if (!k) continue;
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return Array.from(m.entries()).filter(([, v]) => v.length > 1);
  };

  for (const [k, ps] of group((p) => p.metaTitle || p.title)) {
    for (const p of ps) {
      out.push(
        issue({
          code: "dup.title",
          severity: "warning",
          category: "content",
          title: `Одинаковый заголовок у нескольких статей: «${p.title}»`,
          detail: `Такой же Title у ещё ${ps.length - 1}. Поисковик не поймёт, какую страницу показывать.`,
          fix: "Сделайте заголовки уникальными.",
          target: p.slug,
          targetId: p.id,
        })
      );
      void k;
    }
  }
  for (const [, ps] of group((p) => p.metaDescription || p.excerpt)) {
    for (const p of ps) {
      out.push(
        issue({
          code: "dup.description",
          severity: "warning",
          category: "content",
          title: `Одинаковое описание у нескольких статей: «${p.title}»`,
          detail: `Такой же Description у ещё ${ps.length - 1}.`,
          fix: "Напишите уникальное описание для каждой статьи.",
          target: p.slug,
          targetId: p.id,
        })
      );
    }
  }
  for (const [kw, ps] of group((p) => p.keywords[0] ?? "")) {
    for (const p of ps) {
      out.push(
        issue({
          code: "dup.main-keyword",
          severity: "warning",
          category: "content",
          title: `Две статьи под один запрос «${kw}»: «${p.title}»`,
          detail: `Ещё ${ps.length - 1} ст. продвигаются под тот же главный запрос и будут конкурировать между собой.`,
          fix: "Разведите темы: у каждой статьи свой главный запрос, либо объедините материалы в один.",
          target: p.slug,
          targetId: p.id,
        })
      );
    }
  }

  return out;
}

// ───────────────────────── настройка и подключения ─────────────────────────

export function auditSetup(
  env: Record<string, string | undefined>,
  lastCronRunAt: Date | null,
  now: Date
): RawIssue[] {
  const out: RawIssue[] = [];
  if (!lastCronRunAt || now.getTime() - lastCronRunAt.getTime() > 8 * DAY) {
    out.push(
      issue({
        code: "setup.no-cron",
        severity: "info",
        category: "setup",
        title: "Автоматическая проверка не настроена",
        detail: "Проверка по расписанию давно не запускалась, поэтому о проблемах вы узнаёте только заходя в админку.",
        fix: "Настройте ежедневный POST на /api/cron/seo-audit с заголовком x-cron-secret (так же, как для /api/cron/renew).",
      })
    );
  }
  if (!env.ADMIN_NOTIFY_EMAIL) {
    out.push(
      issue({
        code: "setup.no-email",
        severity: "info",
        category: "setup",
        title: "Не задан email для уведомлений",
        detail: "Без ADMIN_NOTIFY_EMAIL письма о новых SEO-проблемах некуда отправлять.",
        fix: "Добавьте переменную ADMIN_NOTIFY_EMAIL в настройках приложения.",
      })
    );
  }
  if (!env.YANDEX_WEBMASTER_TOKEN) {
    out.push(
      issue({
        code: "setup.yandex-webmaster",
        severity: "info",
        category: "indexing",
        title: "Не подключён Яндекс.Вебмастер",
        detail: "Без него монитор не видит позиции, индексацию и ошибки, о которых сообщает Яндекс.",
        fix: "Подтвердите сайт в Яндекс.Вебмастере и добавьте токен в YANDEX_WEBMASTER_TOKEN.",
      })
    );
  }
  if (!env.GOOGLE_SC_CLIENT_EMAIL) {
    out.push(
      issue({
        code: "setup.google-sc",
        severity: "info",
        category: "indexing",
        title: "Не подключён Google Search Console",
        detail: "Без него монитор не видит запросы, клики и индексацию в Google.",
        fix: "Подтвердите сайт в Search Console, создайте сервисный аккаунт и добавьте его данные в переменные окружения.",
      })
    );
  }
  return out;
}

// ───────────────────────── разбор HTML страницы ─────────────────────────

export interface PageFacts {
  title: string;
  description: string;
  canonical: string;
  h1Count: number;
  ogImage: string;
  noindex: boolean;
  hasJsonLd: boolean;
  /** Подключены ли шрифты с серверов Google (внешний CSS блокирует отрисовку) */
  hasGoogleFonts: boolean;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function metaContent(html: string, attr: "name" | "property", key: string): string {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const k = new RegExp(`${attr}\\s*=\\s*"${key}"`, "i").test(tag);
    if (!k) continue;
    const c = /content\s*=\s*"([^"]*)"/i.exec(tag);
    if (c) return decode(c[1]).trim();
  }
  return "";
}

export function parsePage(html: string): PageFacts {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "";
  const canon = /<link\b[^>]*rel\s*=\s*"canonical"[^>]*>/i.exec(html)?.[0] ?? "";
  const canonical = /href\s*=\s*"([^"]*)"/i.exec(canon)?.[1] ?? "";
  const robots = metaContent(html, "name", "robots").toLowerCase();
  return {
    title: decode(title).trim(),
    description: metaContent(html, "name", "description"),
    canonical: decode(canonical).trim(),
    h1Count: (html.match(/<h1[\s>]/gi) ?? []).length,
    ogImage: metaContent(html, "property", "og:image"),
    noindex: robots.includes("noindex"),
    hasJsonLd: /application\/ld\+json/i.test(html),
    hasGoogleFonts: /<link[^>]+(fonts\.googleapis\.com|fonts\.gstatic\.com)/i.test(html),
  };
}

// ───────────────────────── проверки загруженной страницы ─────────────────────────

export interface FetchedPage {
  path: string;
  status: number;
  ms: number;
  html: string;
  /** статья блога — для неё нужна картинка для соцсетей */
  isPost: boolean;
  targetId: string;
  hasCover: boolean;
}

export function auditFetchedPage(page: FetchedPage, siteUrl: string): RawIssue[] {
  const out: RawIssue[] = [];
  const base = { target: page.path, targetId: page.targetId };
  const where = page.path === "/" ? "главная страница" : page.path;

  if (page.status !== 200) {
    out.push(
      issue({
        ...base,
        code: "page.http",
        severity: "critical",
        category: "technical",
        title: `Страница не открывается (код ${page.status}): ${where}`,
        detail: "Поисковый робот получил ошибку вместо страницы — она не попадёт в индекс или вылетит из него.",
        fix: "Откройте адрес в браузере и найдите причину; если страница не нужна — уберите её из sitemap и ссылок.",
      })
    );
    return out;
  }

  if (page.ms > 3000) {
    out.push(
      issue({
        ...base,
        code: "page.slow",
        severity: "warning",
        category: "technical",
        title: `Страница отвечает медленно (${(page.ms / 1000).toFixed(1)} с): ${where}`,
        detail: "Ответ дольше 3 секунд ухудшает поведенческие факторы и может снижать позиции.",
        fix: "Проверьте нагрузку на сервер и базу; повторите проверку — единичный всплеск не страшен.",
      })
    );
  }

  const f = parsePage(page.html);

  // Шрифты — общее место всего сайта, поэтому сообщаем один раз, по главной
  if (page.path === "/" && f.hasGoogleFonts) {
    out.push(
      issue({
        ...base,
        code: "page.google-fonts",
        severity: "info",
        category: "technical",
        title: "Шрифты грузятся с серверов Google",
        detail: "Внешний CSS блокирует отрисовку страницы, а у части посетителей из России запросы к Google идут медленно или не проходят — страница дольше остаётся пустой.",
        fix: "Подключите шрифты с собственного сервера (public/fonts + @font-face в app/globals.css) и уберите ссылки на fonts.googleapis.com из app/layout.tsx.",
      })
    );
  }

  if (f.noindex) {
    out.push(
      issue({
        ...base,
        code: "page.noindex",
        severity: "critical",
        category: "indexing",
        title: `Страница закрыта от индексации (noindex): ${where}`,
        detail: "Мета-тег robots запрещает показывать эту страницу в поиске.",
        fix: "Уберите noindex, если страница должна приводить трафик.",
      })
    );
  }
  if (!f.title) {
    out.push(
      issue({
        ...base,
        code: "page.no-title",
        severity: "critical",
        category: "technical",
        title: `У страницы нет <title>: ${where}`,
        detail: "Заголовок — главный сигнал для поиска.",
        fix: "Задайте title в настройках страницы.",
      })
    );
  }
  if (!f.description) {
    out.push(
      issue({
        ...base,
        code: "page.no-description",
        severity: "warning",
        category: "technical",
        title: `Нет meta description: ${where}`,
        detail: "Поисковик сам выберет фрагмент для сниппета — обычно хуже, чем написанный вручную.",
        fix: "Добавьте описание 70–170 символов.",
      })
    );
  }
  if (!f.canonical) {
    out.push(
      issue({
        ...base,
        code: "page.no-canonical",
        severity: "warning",
        category: "technical",
        title: `Нет canonical: ${where}`,
        detail: "Без канонического адреса одну страницу могут посчитать несколькими копиями.",
        fix: "Добавьте rel=canonical на основной адрес страницы.",
      })
    );
  } else {
    const expect = new URL(page.path, siteUrl).toString().replace(/\/$/, "");
    const got = f.canonical.replace(/\/$/, "");
    // Сравниваем без домена: на тестовом домене canonical всё равно ведёт на боевой
    const strip = (u: string) => u.replace(/^https?:\/\/[^/]+/i, "");
    if (strip(expect) !== strip(got) && !(page.path === "/" && strip(got) === "")) {
      out.push(
        issue({
          ...base,
          code: "page.canonical-mismatch",
          severity: "warning",
          category: "technical",
          title: `Canonical ведёт на другую страницу: ${where}`,
          detail: `Canonical: ${f.canonical}. Поисковик может проигнорировать эту страницу в пользу той.`,
          fix: "Проверьте, что canonical совпадает с адресом самой страницы.",
        })
      );
    }
  }
  if (f.h1Count !== 1) {
    out.push(
      issue({
        ...base,
        code: "page.h1",
        severity: "warning",
        category: "technical",
        title: f.h1Count === 0 ? `Нет заголовка H1: ${where}` : `Несколько заголовков H1 (${f.h1Count}): ${where}`,
        detail: "На странице должен быть ровно один H1 — он объясняет поисковику главную тему.",
        fix: "Оставьте один H1, остальные сделайте H2/H3.",
      })
    );
  }
  if (page.isPost && page.hasCover && !f.ogImage) {
    out.push(
      issue({
        ...base,
        code: "page.no-og-image",
        severity: "warning",
        category: "technical",
        title: `Нет картинки для соцсетей (og:image): ${where}`,
        detail: "Ссылка на статью в мессенджерах и соцсетях будет без превью.",
        fix: "Проверьте, что обложка сохранена, и пересохраните статью.",
      })
    );
  }
  if (page.isPost && !f.hasJsonLd) {
    out.push(
      issue({
        ...base,
        code: "page.no-jsonld",
        severity: "info",
        category: "technical",
        title: `Нет структурированных данных: ${where}`,
        detail: "Разметка помогает поисковику понять, что это статья, и показывать расширенный сниппет.",
        fix: "Структурированные данные должны добавляться автоматически — сообщите разработчику.",
      })
    );
  }
  return out;
}

export function auditRobots(status: number, text: string): RawIssue[] {
  const out: RawIssue[] = [];
  if (status !== 200) {
    out.push(
      issue({
        code: "robots.missing",
        severity: "warning",
        category: "indexing",
        title: `robots.txt недоступен (код ${status})`,
        detail: "Роботы не получили правил обхода сайта.",
        fix: "Проверьте, что адрес /robots.txt открывается.",
        target: "/robots.txt",
      })
    );
    return out;
  }
  if (/^\s*disallow:\s*\/blog\b/im.test(text) || /^\s*disallow:\s*\/\s*$/im.test(text)) {
    out.push(
      issue({
        code: "robots.blocks-blog",
        severity: "critical",
        category: "indexing",
        title: "robots.txt запрещает индексировать блог или весь сайт",
        detail: "Найдена строка Disallow, закрывающая важные страницы.",
        fix: "Уберите Disallow для /blog и корня сайта в app/robots.ts.",
        target: "/robots.txt",
      })
    );
  }
  if (!/^\s*sitemap:/im.test(text)) {
    out.push(
      issue({
        code: "robots.no-sitemap",
        severity: "warning",
        category: "indexing",
        title: "В robots.txt не указан sitemap",
        detail: "Роботам сложнее найти карту сайта.",
        fix: "Добавьте строку Sitemap: https://ваш-домен/sitemap.xml.",
        target: "/robots.txt",
      })
    );
  }
  return out;
}

export function auditSitemap(status: number, text: string, livePosts: { slug: string; id: string }[]): RawIssue[] {
  const out: RawIssue[] = [];
  if (status !== 200) {
    out.push(
      issue({
        code: "sitemap.missing",
        severity: "critical",
        category: "indexing",
        title: `sitemap.xml недоступен (код ${status})`,
        detail: "Без карты сайта новые статьи индексируются заметно медленнее.",
        fix: "Откройте /sitemap.xml в браузере и найдите причину ошибки.",
        target: "/sitemap.xml",
      })
    );
    return out;
  }
  for (const p of livePosts) {
    if (!text.includes(`/blog/${p.slug}<`)) {
      out.push(
        issue({
          code: "sitemap.missing-post",
          severity: "warning",
          category: "indexing",
          title: `Статьи нет в sitemap: /blog/${p.slug}`,
          detail: "Опубликованная статья не попала в карту сайта — поисковик может долго её не замечать.",
          fix: "Обновите sitemap (он строится сам при запросе) и убедитесь, что статья опубликована.",
          target: p.slug,
          targetId: p.id,
        })
      );
    }
  }
  return out;
}

// ───────────────────────── оценка ─────────────────────────

// ───────────────────────── IndexNow ─────────────────────────

export interface IndexNowState {
  key: string | null;
  /** Ответ на запрос /<ключ>.txt с самого сайта; null — не удалось проверить */
  keyFile: { status: number; text: string } | null;
  lastPing: { createdAt: Date; yandex: number } | null;
  /** Самая давняя необработанная правка опубликованной статьи; null — всё отправлено */
  pendingSince: Date | null;
}

/** Проверяет, что сообщение Яндексу о новых страницах (IndexNow) действительно работает */
export function auditIndexNow(s: IndexNowState, now: Date): RawIssue[] {
  const out: RawIssue[] = [];
  const base = { category: "indexing" as Category };
  if (!s.key) {
    out.push(
      issue({
        ...base,
        code: "indexnow.no-key",
        severity: "warning",
        title: "IndexNow не настроен: нет ключа",
        detail: "Без ключа сайт не может сам сообщать Яндексу о новых статьях — они ждут обхода робота.",
        fix: "Задайте переменную NEXTAUTH_SECRET (из неё ключ строится сам) или INDEXNOW_KEY (8–128 латинских букв, цифр и дефисов).",
        target: "/",
      })
    );
    return out;
  }
  if (s.keyFile && (s.keyFile.status !== 200 || s.keyFile.text.trim() !== s.key)) {
    out.push(
      issue({
        ...base,
        code: "indexnow.key-file",
        severity: "warning",
        title: `Файл-подтверждение IndexNow недоступен (код ${s.keyFile.status})`,
        detail: "Яндекс сверяет ключ с файлом /<ключ>.txt в корне сайта; без него уведомления отклоняются.",
        fix: `Откройте /${s.key}.txt в браузере: должен показываться сам ключ. Проверьте rewrites в next.config.js.`,
        target: `/${s.key}.txt`,
      })
    );
  }
  if (s.lastPing && s.lastPing.yandex !== 200 && s.lastPing.yandex !== 202) {
    out.push(
      issue({
        ...base,
        code: "indexnow.failing",
        severity: "warning",
        title: s.lastPing.yandex === 0 ? "Не удалось отправить уведомление Яндексу (IndexNow)" : `Яндекс не принял уведомление IndexNow (код ${s.lastPing.yandex})`,
        detail:
          s.lastPing.yandex === 403 || s.lastPing.yandex === 422
            ? "Яндекс не смог подтвердить ключ или адрес не относится к сайту."
            : "Сервер не достучался до Яндекса или тот вернул ошибку.",
        fix: "Проверьте файл-подтверждение ключа и доступ сервера в интернет; нажмите «Отправить сейчас» в блоке IndexNow ещё раз.",
        target: "/",
      })
    );
  }
  if (s.pendingSince && now.getTime() - s.pendingSince.getTime() > 3 * DAY) {
    out.push(
      issue({
        ...base,
        code: "indexnow.pending",
        severity: "info",
        title: "Есть статьи, о которых Яндекс не уведомлён более 3 дней",
        detail: "Уведомление уходит при сохранении статьи и ежедневной проверкой по расписанию.",
        fix: "Нажмите «Отправить сейчас» в блоке IndexNow и проверьте, что настроена ежедневная проверка по расписанию.",
        target: "/",
      })
    );
  }
  return out;
}

// ───────────────────────── роботы и ИИ-ассистенты ─────────────────────────

export interface BotVisitInfo {
  bot: string;
  lastSeenAt: Date;
  lastVerifiedAt: Date | null;
}


/**
 * Следит, что Яндекс и Google вообще заходят на сайт. Сравнивает последний визит с «точкой отсчёта»:
 * если визитов нет совсем, отсчёт идёт с момента, когда мы начали наблюдение, — сразу после установки
 * ложной тревоги не будет.
 */
export function auditBotVisits(visits: BotVisitInfo[], trackingSince: Date, now: Date): RawIssue[] {
  const out: RawIssue[] = [];
  const byId = new Map(visits.map((v) => [v.bot, v]));
  const watched = [
    { id: "yandex", name: "Яндекса", where: "Яндекс.Вебмастер → Индексирование → Переобход страниц" },
    { id: "google", name: "Google", where: "Google Search Console → Проверка URL → «Запросить индексирование»" },
  ];
  for (const w of watched) {
    const v = byId.get(w.id);
    const ref = v ? v.lastSeenAt : trackingSince;
    const days = Math.floor((now.getTime() - ref.getTime()) / DAY);
    if (days < 7) continue;
    const severity: Severity = days >= 21 ? "critical" : "warning";
    out.push(
      issue({
        code: `bots.${w.id}-stale`,
        severity,
        category: "indexing",
        title: v ? `Робот ${w.name} не заходил на сайт ${days} дн.` : `Робот ${w.name} ни разу не заходил на сайт за ${days} дн. наблюдения`,
        detail: v
          ? "Если робот перестал приходить, новые статьи и правки не попадают в поиск."
          : "Учёт визитов ведётся с момента установки. Робот либо ещё не нашёл сайт, либо ему что-то мешает.",
        fix: `Убедитесь, что сайт добавлен в панель вебмастера, sitemap.xml отправлен, и попросите переобход: ${w.where}.`,
        target: "/sitemap.xml",
      })
    );
  }
  const aiIds = new Set(BOTS.filter((b) => b.kind === "ai").map((b) => b.id));
  const lastAi = visits.filter((v) => aiIds.has(v.bot)).reduce<Date | null>((m, v) => (!m || v.lastSeenAt > m ? v.lastSeenAt : m), null);
  const aiDays = Math.floor((now.getTime() - (lastAi ?? trackingSince).getTime()) / DAY);
  if (aiDays >= 30) {
    out.push(
      issue({
        code: "bots.ai-none",
        severity: "info",
        category: "indexing",
        title: `ИИ-роботы не заходили на сайт ${aiDays} дн.`,
        detail: "ChatGPT, Claude, Perplexity, Алиса и другие ассистенты узнают о сайте только после захода своих роботов.",
        fix: "Проверьте, что /llms.txt и /robots.txt открываются, публикуйте статьи регулярно и добавьте ссылки на сайт на внешних площадках — по ним роботы находят новые сайты.",
        target: "/llms.txt",
      })
    );
  }
  return out;
}

/** Парсит robots.txt в группы: список User-agent → список правил */
function robotsGroups(text: string): { agents: string[]; rules: { type: string; path: string }[] }[] {
  const groups: { agents: string[]; rules: { type: string; path: string }[] }[] = [];
  let cur: { agents: string[]; rules: { type: string; path: string }[] } | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(m[2].trim().toLowerCase());
      lastWasAgent = true;
    } else if (cur && (key === "disallow" || key === "allow")) {
      cur.rules.push({ type: key, path: m[2].trim() });
      lastWasAgent = false;
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

/** Не закрыт ли сайт от ИИ-роботов явным «Disallow: /» для их User-agent */
export function auditAiRobots(text: string): RawIssue[] {
  const out: RawIssue[] = [];
  const groups = robotsGroups(text);
  const tokens = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "YandexAdditional"];
  const blocked: string[] = [];
  for (const t of tokens) {
    const g = groups.find((x) => x.agents.includes(t.toLowerCase()));
    if (!g) continue;
    const closed = g.rules.some((r) => r.type === "disallow" && r.path === "/") && !g.rules.some((r) => r.type === "allow" && r.path === "/");
    if (closed) blocked.push(t);
  }
  if (blocked.length) {
    out.push(
      issue({
        code: "robots.blocks-ai",
        severity: "warning",
        category: "indexing",
        title: `robots.txt закрывает сайт от ИИ-роботов: ${blocked.join(", ")}`,
        detail: "Закрытый от робота сайт ассистент не прочитает и не сможет порекомендовать.",
        fix: "Уберите «Disallow: /» для этих роботов в app/robots.ts (список AI_ROBOTS_TOKENS в lib/bots.ts).",
        target: "/robots.txt",
      })
    );
  }
  return out;
}

/** Файл /llms.txt — «оглавление сайта» для ИИ-ассистентов */
export function auditLlms(status: number, text: string): RawIssue[] {
  const base = { category: "indexing" as Category, target: "/llms.txt" };
  if (status !== 200) {
    return [
      issue({
        ...base,
        code: "llms.missing",
        severity: "warning",
        title: `Файл llms.txt недоступен (код ${status})`,
        detail: "ИИ-ассистентам нечего прочитать о сайте одним файлом: что за сервис, какие тарифы, где статьи.",
        fix: "Откройте /llms.txt в браузере и найдите причину ошибки.",
      }),
    ];
  }
  const out: RawIssue[] = [];
  if (text.trim().length < 300 || !/^#\s+\S/m.test(text)) {
    out.push(
      issue({
        ...base,
        code: "llms.thin",
        severity: "info",
        title: "llms.txt почти пустой",
        detail: "В файле должны быть название сайта, краткое описание и ссылки на главные разделы.",
        fix: "Проверьте lib/geo.ts: функция buildLlmsTxt.",
      })
    );
  }
  return out;
}

/** Типы schema.org из всех блоков JSON-LD страницы (включая @graph и вложенные массивы) */
export function extractJsonLdTypes(html: string): string[] {
  const types = new Set<string>();
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (n && typeof n === "object") {
      const o = n as Record<string, unknown>;
      const t = o["@type"];
      if (typeof t === "string") types.add(t);
      else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));
      if (o["@graph"]) walk(o["@graph"]);
    }
  };
  for (const m of Array.from(html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi))) {
    try {
      walk(JSON.parse(m[1]));
    } catch {
      // битый JSON-LD — просто не учитываем
    }
  }
  return Array.from(types);
}

/** Разметка главной, по которой ИИ и поисковики понимают, что это за компания и какие у неё услуги */
export function auditHomeStructured(html: string): RawIssue[] {
  const types = extractJsonLdTypes(html);
  const need: { type: string; why: string }[] = [
    { type: "Organization", why: "кто стоит за сайтом" },
    { type: "FAQPage", why: "готовые вопросы и ответы, которые ассистенты цитируют" },
    { type: "Service", why: "что за услуга и сколько стоит" },
  ];
  const missing = need.filter((n) => !types.includes(n.type));
  if (!missing.length) return [];
  return [
    issue({
      code: "home.structured-data",
      severity: "info",
      category: "technical",
      title: `На главной нет разметки: ${missing.map((m) => m.type).join(", ")}`,
      detail: missing.map((m) => `${m.type} — ${m.why}`).join("; ") + ".",
      fix: "Разметка собирается в lib/geo.ts (homeJsonLd) и app/layout.tsx. Проверьте, что она выводится на главной.",
      target: "/",
    }),
  ];
}

export function computeScore(issues: { severity: string }[]): number {
  const n = (s: string) => issues.filter((i) => i.severity === s).length;
  // Ограничиваем вклад мелочей, чтобы десяток замечаний «info» не обнулял оценку
  const penalty = Math.min(n("critical") * 15, 60) + Math.min(n("warning") * 4, 40) + Math.min(n("info"), 15);
  return Math.max(0, 100 - penalty);
}
