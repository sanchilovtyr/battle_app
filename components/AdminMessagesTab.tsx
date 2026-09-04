"use client";

import { useEffect, useMemo, useState } from "react";
import { addMessage, getThreads, SupportThread } from "@/lib/support";
import { MOCK_USERS } from "@/lib/adminMockData";
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

export default function AdminMessagesTab({ prefillEmail }: { prefillEmail?: string | null }) {
  const [version, setVersion] = useState(0);
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  const threads = useMemo(() => getThreads(), [version]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || (!body.trim() && !image)) return;
    addMessage(email, "admin", body, image);
    setBody("");
    setImage(undefined);
    setSent(true);
    setVersion((v) => v + 1);
    setTimeout(() => setSent(false), 2500);
  };

  return (
    <div>
      <div className="mb-5 rounded-xl border border-violet/30 bg-violet-soft p-4 text-sm text-violet">
        Сообщения реально сохраняются и показываются в личном кабинете — но только в этом же
        браузере: у сервиса пока нет общего бэкенда, поэтому доставить сообщение на другое
        устройство отсюда нельзя (см. README).
      </div>

      <div className="mb-8 rounded-2xl border border-line bg-white p-6">
        <h3 className="mb-4 font-display text-base text-ink-900">Написать пользователю</h3>
        <form onSubmit={send} className="grid gap-3">
          <input
            list="admin-known-emails"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email пользователя"
            className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
          />
          <datalist id="admin-known-emails">
            {MOCK_USERS.map((u) => (
              <option key={u.id} value={u.email} />
            ))}
          </datalist>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Текст сообщения"
            rows={3}
            className="w-full resize-none rounded-xl border border-line p-3 text-sm outline-none focus:border-violet"
          />
          <ImageAttachField value={image} onChange={setImage} />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="w-fit rounded-full bg-ink-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-ink-800"
            >
              Отправить
            </button>
            {sent && <span className="text-sm text-violet">Отправлено</span>}
          </div>
        </form>
      </div>

      <h3 className="mb-3 font-display text-base text-ink-900">Обращения</h3>
      {threads.length === 0 && (
        <p className="text-sm text-muted">Пока никто не писал в поддержку.</p>
      )}
      <div className="space-y-4">
        {threads.map((t) => (
          <ThreadCard key={t.email} thread={t} onReply={(addr) => setEmail(addr)} />
        ))}
      </div>
    </div>
  );
}

function ThreadCard({
  thread,
  onReply,
}: {
  thread: SupportThread;
  onReply: (email: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const last = thread.messages[thread.messages.length - 1];

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-ink-900">{thread.email}</p>
          <p className="text-xs text-muted">
            {thread.messages.length} сообщений · последнее {formatDateTime(thread.lastAt)} от{" "}
            {last.from === "admin" ? "поддержки" : "пользователя"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onReply(thread.email)}
            className="rounded-full border border-ink-900/20 px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-soft"
          >
            Ответить
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-full bg-ink-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-800"
          >
            {open ? "Скрыть" : "Показать переписку"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-2.5 border-t border-line pt-4">
          {thread.messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-xl p-3 text-sm ${
                m.from === "admin" ? "ml-auto bg-violet-soft text-ink-900" : "bg-soft text-ink-900"
              }`}
            >
              <p className="mb-1 text-[11px] font-medium text-muted">
                {m.from === "admin" ? "Поддержка" : "Пользователь"} · {formatDateTime(m.createdAt)}
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
    </div>
  );
}
