import { SLUG_RE, slugify } from "@/lib/slug";
import { parseImageDataUrl } from "@/lib/blog";

export interface BlogWrite {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverAlt: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  authorName: string;
  authorRole: string;
  authorBio: string;
  published: boolean;
  publishedAt: Date | null;
  /** undefined — не трогать обложку; null — удалить; Buffer — заменить */
  cover: Buffer | null | undefined;
}

type Result = { ok: true; data: BlogWrite } | { ok: false; error: string };

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/**
 * Проверка тела запроса из админки. existingPublishedAt — дата первой публикации,
 * чтобы повторное сохранение уже опубликованной статьи не сдвигало её «дату выхода»
 */
export function parseBlogInput(raw: unknown, existingPublishedAt: Date | null = null): Result {
  const b = (raw ?? {}) as Record<string, unknown>;
  const title = str(b.title, 120);
  const body = String(b.body ?? "").trim().slice(0, 60000);
  if (!title) return { ok: false, error: "Укажите заголовок" };
  if (!body) return { ok: false, error: "Напишите текст статьи" };

  const slug = str(b.slug, 80) || slugify(title);
  if (!slug || !SLUG_RE.test(slug)) {
    return { ok: false, error: "Адрес статьи: только латиница, цифры и дефисы (например, kak-privlech-klientov)" };
  }

  const keywords = (Array.isArray(b.keywords) ? b.keywords : [])
    .map((k) => str(k, 60).toLowerCase())
    .filter(Boolean)
    .filter((k, i, a) => a.indexOf(k) === i)
    .slice(0, 15);

  const mode = String(b.publishMode ?? "draft");
  let published = false;
  let publishedAt: Date | null = null;
  if (mode === "now") {
    published = true;
    publishedAt = existingPublishedAt && existingPublishedAt <= new Date() ? existingPublishedAt : new Date();
  } else if (mode === "schedule") {
    const d = new Date(String(b.publishAt ?? ""));
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Укажите дату и время публикации" };
    published = true;
    publishedAt = d;
  }

  let cover: Buffer | null | undefined = undefined;
  if (b.cover === null) cover = null;
  else if (typeof b.cover === "string" && b.cover) {
    const buf = parseImageDataUrl(b.cover);
    if (!buf) return { ok: false, error: "Обложка: нужен JPEG/PNG/WebP до 900 КБ" };
    cover = buf;
  }

  return {
    ok: true,
    data: {
      slug,
      title,
      excerpt: str(b.excerpt, 300),
      body,
      coverAlt: str(b.coverAlt, 200),
      metaTitle: str(b.metaTitle, 120),
      metaDescription: str(b.metaDescription, 300),
      keywords,
      authorName: str(b.authorName, 80),
      authorRole: str(b.authorRole, 120),
      authorBio: str(b.authorBio, 400),
      published,
      publishedAt,
      cover,
    },
  };
}

export function toPrismaData(d: BlogWrite) {
  const { cover, ...rest } = d;
  return {
    ...rest,
    ...(cover === undefined ? {} : { coverData: cover, hasCover: cover !== null }),
  };
}
