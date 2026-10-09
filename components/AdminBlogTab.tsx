"use client";

import { useEffect, useMemo, useState } from "react";
import Markdown from "@/components/Markdown";
import { slugify } from "@/lib/slug";
import { fileToCompressedDataUrl } from "@/lib/imageUtils";

interface PostRow {
  id: string;
  slug: string;
  title: string;
  published: boolean;
  publishedAt: string | null;
  hasCover: boolean;
  keywords: string[];
  updatedAt: string;
}

interface Draft {
  id: string | null;
  title: string;
  slug: string;
  slugTouched: boolean;
  excerpt: string;
  body: string;
  coverAlt: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  authorName: string;
  authorRole: string;
  authorBio: string;
  publishMode: "draft" | "now" | "schedule";
  publishAt: string;
  /** undefined — не менять, null — удалить, строка — новая картинка (data URL) */
  cover: string | null | undefined;
  hasCover: boolean;
  coverPreview: string | null;
}

const EMPTY: Draft = {
  id: null,
  title: "",
  slug: "",
  slugTouched: false,
  excerpt: "",
  body: "",
  coverAlt: "",
  metaTitle: "",
  metaDescription: "",
  keywords: "",
  authorName: "",
  authorRole: "",
  authorBio: "",
  publishMode: "draft",
  publishAt: "",
  cover: undefined,
  hasCover: false,
  coverPreview: null,
};

const BODY_HINT = `## Подзаголовок второго уровня
Абзац текста. **Жирный**, *курсив*, [ссылка на раздел](/#wizard).

- пункт списка
- ещё пункт

1. шаг первый
2. шаг второй

> Цитата или важная мысль`;

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusOf(p: PostRow): { label: string; cls: string } {
  if (!p.published) return { label: "Черновик", cls: "bg-soft text-muted" };
  if (p.publishedAt && new Date(p.publishedAt) > new Date()) {
    return {
      label: `Запланирована на ${new Date(p.publishedAt).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`,
      cls: "bg-violet-soft text-violet",
    };
  }
  return { label: "Опубликована", cls: "bg-brand text-ink-900" };
}

interface Check {
  ok: boolean;
  text: string;
}

function seoChecks(d: Draft): Check[] {
  const kws = d.keywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
  const main = kws[0];
  const title = (d.metaTitle || d.title).toLowerCase();
  const firstPara = d.body.trim().split(/\n\s*\n/)[0]?.toLowerCase() ?? "";
  const words = d.body.trim() ? d.body.trim().split(/\s+/).length : 0;
  const titleLen = (d.metaTitle || d.title).length;
  const descLen = (d.metaDescription || d.excerpt).length;
  return [
    { ok: kws.length > 0, text: "Указано хотя бы одно ключевое слово (первое — главное)" },
    { ok: !main || title.includes(main), text: "Главное ключевое слово есть в заголовке" },
    { ok: !main || firstPara.includes(main), text: "Главное ключевое слово есть в первом абзаце" },
    { ok: titleLen >= 30 && titleLen <= 65, text: `Title 30–65 символов (сейчас ${titleLen})` },
    { ok: descLen >= 70 && descLen <= 170, text: `Description 70–170 символов (сейчас ${descLen})` },
    { ok: words >= 600, text: `Объём от 600 слов (сейчас ${words})` },
    { ok: /^##\s+/m.test(d.body), text: "Есть подзаголовки второго уровня (##)" },
    { ok: d.authorName.trim().length > 0, text: "Указан автор статьи (Яндекс и Google ценят подтверждённую экспертность)" },
    { ok: d.hasCover || Boolean(d.cover), text: "Загружена обложка" },
    { ok: !(d.hasCover || d.cover) || d.coverAlt.trim().length > 0, text: "У обложки заполнен alt-текст" },
  ];
}

const AUTHOR_KEY = "blog-last-author";
const input = "w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet";
const label = "mb-1 block text-xs font-bold text-ink-900/70";

export default function AdminBlogTab({
  openPostId,
  onOpened,
}: {
  openPostId?: string | null;
  onOpened?: () => void;
}) {
  const [posts, setPosts] = useState<PostRow[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const load = () => {
    fetch("/api/admin/blog")
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((data) => setPosts(data.posts))
      .catch(() => setPosts([]));
  };
  useEffect(load, []);

  const checks = useMemo(() => (draft ? seoChecks(draft) : []), [draft]);
  const score = checks.filter((c) => c.ok).length;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const startNew = () => {
    setError(null);
    setNotice(null);
    setPreview(false);
    // Автора запоминаем с прошлой статьи, чтобы не вводить его каждый раз
    let author = { authorName: "", authorRole: "", authorBio: "" };
    try {
      const saved = JSON.parse(window.localStorage.getItem(AUTHOR_KEY) || "null");
      if (saved && typeof saved === "object") {
        author = {
          authorName: String(saved.authorName || ""),
          authorRole: String(saved.authorRole || ""),
          authorBio: String(saved.authorBio || ""),
        };
      }
    } catch {
      // localStorage недоступен — просто пустые поля
    }
    setDraft({ ...EMPTY, ...author });
  };

  const edit = async (id: string) => {
    setError(null);
    setNotice(null);
    setPreview(false);
    const res = await fetch(`/api/admin/blog/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.post) {
      setError(data.error || "Не удалось открыть статью");
      return;
    }
    const p = data.post;
    const future = p.publishedAt && new Date(p.publishedAt) > new Date();
    setDraft({
      id: p.id,
      title: p.title,
      slug: p.slug,
      slugTouched: true,
      excerpt: p.excerpt,
      body: p.body,
      coverAlt: p.coverAlt,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      keywords: (p.keywords as string[]).join(", "),
      authorName: p.authorName || "",
      authorRole: p.authorRole || "",
      authorBio: p.authorBio || "",
      publishMode: !p.published ? "draft" : future ? "schedule" : "now",
      publishAt: toLocalInput(p.publishedAt),
      cover: undefined,
      hasCover: p.hasCover,
      coverPreview: p.hasCover ? `/api/admin/blog/${p.id}/cover?v=${new Date(p.updatedAt).getTime()}` : null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Переход из SEO-монитора: «Исправить статью» открывает нужную статью сразу в редакторе
  useEffect(() => {
    if (!openPostId) return;
    edit(openPostId);
    onOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPostId]);

  const onTitle = (v: string) =>
    setDraft((d) => (d ? { ...d, title: v, slug: d.slugTouched ? d.slug : slugify(v) } : d));

  const onCover = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setDraft((d) => (d ? { ...d, cover: dataUrl, coverPreview: dataUrl } : d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обработать картинку");
    }
  };

  const removeCover = () => setDraft((d) => (d ? { ...d, cover: null, coverPreview: null, hasCover: false } : d));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        title: draft.title,
        slug: draft.slug,
        excerpt: draft.excerpt,
        body: draft.body,
        coverAlt: draft.coverAlt,
        metaTitle: draft.metaTitle,
        metaDescription: draft.metaDescription,
        keywords: draft.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        authorName: draft.authorName,
        authorRole: draft.authorRole,
        authorBio: draft.authorBio,
        publishMode: draft.publishMode,
        publishAt: draft.publishMode === "schedule" && draft.publishAt ? new Date(draft.publishAt).toISOString() : null,
        ...(draft.cover !== undefined ? { cover: draft.cover } : {}),
      };
      const res = await fetch(draft.id ? `/api/admin/blog/${draft.id}` : "/api/admin/blog", {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось сохранить");
        return;
      }
      try {
        window.localStorage.setItem(
          AUTHOR_KEY,
          JSON.stringify({ authorName: draft.authorName, authorRole: draft.authorRole, authorBio: draft.authorBio })
        );
      } catch {
        // не страшно: просто не запомним автора
      }
      const ping = data.indexNow && data.indexNow.sent > 0
        ? data.indexNow.yandex === 200 || data.indexNow.yandex === 202
          ? " Яндекс и Bing уведомлены."
          : " Не удалось уведомить Яндекс — подробности в «SEO-монитор»."
        : "";
      setNotice(
        (draft.publishMode === "draft"
          ? "Черновик сохранён"
          : draft.publishMode === "schedule"
          ? "Сохранено — статья выйдет в назначенное время"
          : "Статья опубликована") + ping
      );
      setDraft(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Удалить статью безвозвратно?")) return;
    await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    if (draft?.id === id) setDraft(null);
    load();
  };

  return (
    <div>
      {notice && <p className="mb-4 rounded-xl bg-brand-soft p-3 text-sm text-ink-900">{notice}</p>}

      {!draft && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Статьи выходят на <span className="font-mono text-ink-900">/blog</span> и попадают в sitemap автоматически.
          </p>
          <button
            onClick={startNew}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-extrabold text-ink-900 transition hover:-translate-y-0.5"
          >
            + Новая статья
          </button>
        </div>
      )}

      {draft && (
        <form onSubmit={save} className="mb-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-4 rounded-2xl border border-line bg-white p-6">
            <h3 className="font-display text-base text-ink-900">{draft.id ? "Редактирование статьи" : "Новая статья"}</h3>

            <div>
              <label className={label}>Заголовок (H1)</label>
              <input value={draft.title} onChange={(e) => onTitle(e.target.value)} maxLength={120} className={input} placeholder="Как привлечь первых клиентов из интернета" />
            </div>

            <div>
              <label className={label}>Адрес статьи (slug)</label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted">/blog/</span>
                <input
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value, slugTouched: true })}
                  className={`${input} font-mono`}
                  placeholder="kak-privlech-klientov"
                />
              </div>
              <p className="mt-1 text-xs text-muted">Строится из заголовка автоматически. После публикации лучше не менять — старая ссылка перестанет работать.</p>
            </div>

            <div>
              <label className={label}>Краткое описание (для превью и анонса)</label>
              <textarea value={draft.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={2} maxLength={300} className={`${input} resize-none`} />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className={`${label} mb-0`}>Текст статьи (Markdown)</label>
                <button type="button" onClick={() => setPreview((v) => !v)} className="text-xs font-medium text-violet underline underline-offset-4">
                  {preview ? "Редактировать" : "Предпросмотр"}
                </button>
              </div>
              {preview ? (
                <div className="min-h-[300px] rounded-xl border border-line p-5">
                  <Markdown source={draft.body || "_Пока пусто_"} />
                </div>
              ) : (
                <textarea value={draft.body} onChange={(e) => set("body", e.target.value)} rows={18} className={`${input} font-mono`} placeholder={BODY_HINT} />
              )}
            </div>

            <div className="grid gap-4 rounded-xl bg-soft p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-900/60">Автор (показывается в статье и в разметке для поисковиков)</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={label}>Имя автора</label>
                  <input value={draft.authorName} onChange={(e) => set("authorName", e.target.value)} maxLength={80} className={input} placeholder="Имя Фамилия" />
                </div>
                <div>
                  <label className={label}>Должность или квалификация</label>
                  <input value={draft.authorRole} onChange={(e) => set("authorRole", e.target.value)} maxLength={120} className={input} placeholder="Например: маркетолог, 15 лет практики" />
                </div>
              </div>
              <div>
                <label className={label}>Об авторе (1–2 предложения: опыт, чем занимался, кейсы) · {draft.authorBio.length}/400</label>
                <textarea value={draft.authorBio} onChange={(e) => set("authorBio", e.target.value)} rows={2} maxLength={400} className={`${input} resize-none`} />
              </div>
              <p className="text-xs text-muted">Указывайте только то, что правда: Яндекс оценивает подтверждённую квалификацию автора. Поля запоминаются для следующей статьи.</p>
            </div>

            <div className="grid gap-4 rounded-xl bg-soft p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-900/60">SEO</p>
              <div>
                <label className={label}>Title (если пусто — берётся заголовок) · {(draft.metaTitle || draft.title).length}/65</label>
                <input value={draft.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} maxLength={120} className={input} />
              </div>
              <div>
                <label className={label}>Description (если пусто — краткое описание) · {(draft.metaDescription || draft.excerpt).length}/170</label>
                <textarea value={draft.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} rows={2} maxLength={300} className={`${input} resize-none`} />
              </div>
              <div>
                <label className={label}>Ключевые слова через запятую (первое — главное)</label>
                <input value={draft.keywords} onChange={(e) => set("keywords", e.target.value)} className={input} placeholder="продвижение малого бизнеса, привлечение клиентов" />
              </div>
            </div>
          </div>

          <aside className="grid content-start gap-4">
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="mb-3 text-sm font-bold text-ink-900">Публикация</p>
              <div className="grid gap-2 text-sm">
                {([
                  ["draft", "Черновик"],
                  ["now", "Опубликовать сейчас"],
                  ["schedule", "Запланировать"],
                ] as const).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2">
                    <input type="radio" name="mode" checked={draft.publishMode === v} onChange={() => set("publishMode", v)} className="accent-violet" />
                    {l}
                  </label>
                ))}
              </div>
              {draft.publishMode === "schedule" && (
                <input type="datetime-local" value={draft.publishAt} onChange={(e) => set("publishAt", e.target.value)} className={`${input} mt-3`} />
              )}
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <div className="mt-4 flex gap-2">
                <button type="submit" disabled={saving} className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50">
                  {saving ? "Сохраняем…" : "Сохранить"}
                </button>
                <button type="button" onClick={() => setDraft(null)} className="rounded-full border border-line px-4 py-2.5 text-sm font-medium hover:bg-soft">
                  Отмена
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="mb-3 text-sm font-bold text-ink-900">Обложка (1200×630)</p>
              {draft.coverPreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={draft.coverPreview} alt="" className="mb-3 aspect-[1200/630] w-full rounded-xl border border-line object-cover" />
                  <button type="button" onClick={removeCover} className="mb-3 text-xs font-medium text-red-600 underline underline-offset-4">
                    Убрать обложку
                  </button>
                </>
              ) : null}
              <input type="file" accept="image/*" onChange={(e) => onCover(e.target.files?.[0])} className="mb-3 block w-full text-xs" />
              <label className={label}>Alt-текст (что на картинке)</label>
              <input value={draft.coverAlt} onChange={(e) => set("coverAlt", e.target.value)} maxLength={200} className={input} />
            </div>

            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="mb-3 text-sm font-bold text-ink-900">
                SEO-чеклист <span className="font-mono text-xs text-muted">{score}/{checks.length}</span>
              </p>
              <ul className="space-y-1.5 text-xs">
                {checks.map((c) => (
                  <li key={c.text} className={`flex gap-2 ${c.ok ? "text-ink-900" : "text-muted"}`}>
                    <span className={c.ok ? "text-violet" : "text-muted/50"}>{c.ok ? "✓" : "○"}</span>
                    {c.text}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </form>
      )}

      {!draft && error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <h3 className="mb-3 font-display text-base text-ink-900">Все статьи</h3>
      {posts === null && <p className="text-sm text-muted">Загрузка…</p>}
      {posts?.length === 0 && <p className="text-sm text-muted">Статей пока нет — нажмите «Новая статья».</p>}
      <div className="space-y-3">
        {posts?.map((p) => {
          const st = statusOf(p);
          return (
            <div key={p.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink-900">{p.title}</p>
                  <p className="mt-1 font-mono text-xs text-muted">/blog/{p.slug}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                    {p.keywords.slice(0, 4).map((k) => (
                      <span key={k} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{k}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {p.published && (
                    <a href={`/blog/${p.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line px-3 py-1 text-xs font-medium hover:bg-soft">
                      Открыть
                    </a>
                  )}
                  <button onClick={() => edit(p.id)} className="rounded-full bg-ink-900 px-3 py-1 text-xs font-medium text-white hover:bg-ink-800">
                    Изменить
                  </button>
                  <button onClick={() => remove(p.id)} className="rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
