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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/news")
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((data) => setPosts(data.posts))
      .catch(() => setPosts([]));

    // Отмечаем новости прочитанными при открытии ЛК — бейдж "новое" пропадёт при следующей загрузке
    fetch("/api/news", { method: "POST" }).catch(() => {});
  }, []);

  if (!posts || posts.length === 0) return null;

  const visible = open ? posts : posts.slice(0, 1);

  return (
    <section className="mb-8 rounded-2xl border border-violet/30 bg-violet-soft p-6">
      <h2 className="mb-4 font-display text-lg text-ink-900">Что нового</h2>
      <div className="space-y-4">
        {visible.map((p) => (
          <div key={p.id} className="rounded-xl bg-white p-4">
            <p className="mb-1 font-medium text-ink-900">{p.title}</p>
            <p className="mb-1 text-xs text-muted">{formatDate(p.createdAt)}</p>
            <p className="whitespace-pre-wrap text-sm text-ink-900">{p.body}</p>
          </div>
        ))}
      </div>
      {posts.length > 1 && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-3 text-sm text-violet underline underline-offset-4"
        >
          {open ? "Скрыть" : `Показать ещё (${posts.length - 1})`}
        </button>
      )}
    </section>
  );
}
