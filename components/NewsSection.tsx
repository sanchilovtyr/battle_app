"use client";

import { useEffect, useState } from "react";

interface NewsPost {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function NewsSection() {
  const [posts, setPosts] = useState<NewsPost[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/news")
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((data) => setPosts(data.posts))
      .catch(() => setPosts([]));

    // Отмечаем новости прочитанными при открытии ЛК — бейдж "новое" пропадёт при следующей загрузке
    fetch("/api/news", { method: "POST" }).catch(() => {});
  }, []);

  if (!posts || posts.length === 0) return null;

  const LIMIT = 3;
  const visible = showAll ? posts : posts.slice(0, LIMIT);

  // Новость свёрнута: видны только заголовок и дата, текст раскрывается по клику
  return (
    <section className="mb-8 rounded-2xl border border-violet/30 bg-violet-soft p-4 sm:p-5">
      <h2 className="mb-3 font-display text-lg text-ink-900">Что нового</h2>
      <ul className="space-y-2">
        {visible.map((p) => {
          const open = openId === p.id;
          return (
            <li key={p.id} className="rounded-xl bg-white">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : p.id)}
                aria-expanded={open}
                aria-controls={`news-${p.id}`}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className={`block text-sm font-medium text-ink-900 ${open ? "" : "line-clamp-2"}`}>{p.title}</span>
                  <span className="block text-xs text-muted">{formatDate(p.createdAt)}</span>
                </span>
                <span
                  aria-hidden
                  className={`shrink-0 text-lg leading-none text-violet transition-transform ${open ? "rotate-180" : ""}`}
                >
                  ⌄
                </span>
              </button>
              {open && (
                <div id={`news-${p.id}`} className="border-t border-line px-4 pb-4 pt-3">
                  <p className="whitespace-pre-wrap text-sm text-ink-900">{p.body}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {posts.length > LIMIT && (
        <button onClick={() => setShowAll((o) => !o)} className="mt-3 text-sm text-violet underline underline-offset-4">
          {showAll ? "Скрыть старые" : `Показать ещё (${posts.length - LIMIT})`}
        </button>
      )}
    </section>
  );
}
