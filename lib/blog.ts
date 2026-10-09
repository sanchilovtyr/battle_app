export const SITE_URL = "https://m-navi.ru";
export const BLOG_PAGE_SIZE = 9;
export const MAX_COVER_BYTES = 900 * 1024;

export interface BlogCard {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverAlt: string;
  publishedAt: Date | null;
  updatedAt: Date;
  hasCover: boolean;
  body: string;
}

/** Условие «статья опубликована»: флаг + дата не в будущем (отложенная публикация без cron) */
export function publishedWhere() {
  return { published: true, publishedAt: { lte: new Date() } };
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(wordCount(text) / 180));
}

/** Описание для превью: берём excerpt, а если пусто — начало текста без Markdown-разметки */
export function plainSummary(excerpt: string, body: string, max = 160): string {
  const src = (excerpt || body)
    .replace(/[#>*_`\-\[\]()!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return src.length <= max ? src : src.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

export function formatDate(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export function coverUrl(slug: string, updatedAt: Date | string): string {
  return `/blog/cover/${slug}?v=${new Date(updatedAt).getTime()}`;
}

/** Разбор data URL (image/jpeg|png|webp) в байты; null — если формат не подходит */
export function parseImageDataUrl(dataUrl: string): Buffer | null {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  return buf.length > 0 && buf.length <= MAX_COVER_BYTES ? buf : null;
}

/** Определение MIME по сигнатуре файла — не доверяем тому, что прислал клиент */
export function sniffImageMime(buf: Uint8Array): string {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0x52 && buf[1] === 0x49) return "image/webp";
  return "image/jpeg";
}
