"use client";

import { useEffect, useState } from "react";
import { addMessage, getThreadForEmail, SupportMessage } from "@/lib/support";
import ImageAttachField from "@/components/ImageAttachField";

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function SupportSection({ email }: { email: string }) {
  const [thread, setThread] = useState<SupportMessage[]>([]);
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setThread(getThreadForEmail(email));
  }, [email]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() && !image) return;
    addMessage(email, "user", body, image);
    setThread(getThreadForEmail(email));
    setBody("");
    setImage(undefined);
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <h2 className="mb-4 font-display text-lg text-ink-900">Техподдержка</h2>

      {thread.length > 0 && (
        <div className="mb-5 space-y-3">
          {thread.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-xl p-3.5 text-sm ${
                m.from === "admin"
                  ? "bg-violet-soft text-ink-900"
                  : "ml-auto bg-soft text-ink-900"
              }`}
            >
              <p className="mb-1 text-[11px] font-medium text-muted">
                {m.from === "admin" ? "Поддержка" : "Вы"} · {formatDateTime(m.createdAt)}
              </p>
              {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
              {m.imageDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.imageDataUrl}
                  alt="Вложение"
                  className={`max-h-64 rounded-lg ${m.body ? "mt-2" : ""}`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={send} className="grid gap-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Опишите вопрос — ответим на этот email"
          rows={3}
          className="w-full resize-none rounded-xl border border-line p-3.5 text-sm outline-none focus:border-violet"
        />
        <ImageAttachField value={image} onChange={setImage} />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-800"
          >
            Отправить в поддержку
          </button>
          {sent && <span className="text-sm text-violet">Отправлено</span>}
        </div>
      </form>
    </section>
  );
}
