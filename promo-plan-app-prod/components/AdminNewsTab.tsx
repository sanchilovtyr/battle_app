"use client";

import { useEffect, useState } from "react";

interface NewsPost {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminNewsTab() {
  const [posts, setPosts] = useState<NewsPost[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/admin/news")
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((data) => setPosts(data.posts))
      .catch(() => setPosts([]));
  };

  useEffect(load, []);

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось опубликовать");
        return;
      }
      setTitle("");
      setBody("");
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Удалить эту новость?")) return;
    await fetch(`/api/admin/news/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <div className="mb-6 rounded-2xl border border-line bg-white p-6">
        <h3 className="mb-4 font-display text-base text-ink-900">Опубликовать новость</h3>
        <form onSubmit={publish} className="grid gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок"
            className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Текст новости — что нового появилось в сервисе"
            rows={4}
            className="w-full resize-none rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-fit rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {saving ? "Публикуем…" : "Опубликовать"}
          </button>
        </form>
      </div>

      <h3 className="mb-3 font-display text-base text-ink-900">Опубликованные новости</h3>
      {posts === null && <p className="text-sm text-muted">Загрузка…</p>}
      {posts?.length === 0 && <p className="text-sm text-muted">Новостей пока нет.</p>}
      <div className="space-y-3">
        {posts?.map((p) => (
          <div key={p.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="mb-1 flex items-start justify-between gap-3">
              <p className="font-medium text-ink-900">{p.title}</p>
              <button
                onClick={() => remove(p.id)}
                className="shrink-0 rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Удалить
              </button>
            </div>
            <p className="mb-2 text-xs text-muted">{formatDateTime(p.createdAt)}</p>
            <p className="whitespace-pre-wrap text-sm text-ink-900">{p.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
