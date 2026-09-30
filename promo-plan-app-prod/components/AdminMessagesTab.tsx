"use client";

import { useEffect, useMemo, useState } from "react";
import { addMessage, getThreads, setThreadClosed, SupportThread } from "@/lib/support";
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

type Filter = "open" | "closed" | "all";

export default function AdminMessagesTab({ prefillEmail }: { prefillEmail?: string | null }) {
  const [version, setVersion] = useState(0);
  const [email, setEmail] = useState(prefillEmail ?? "");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);
  const [sent, setSent] = useState(false);
  const [knownEmails, setKnownEmails] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("open");

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setKnownEmails((data.users ?? []).map((u: { email: string }) => u.email)))
      .catch(() => setKnownEmails([]));
  }, []);

  const threads = useMemo(() => getThreads(), [version]);
  const filteredThreads = useMemo(
    () => threads.filter((t) => filter === "all" || (filter === "open" ? !t.closed : t.closed)),
    [threads, filter]
  );
  const openCount = threads.filter((t) => !t.closed).length;
  const closedCount = threads.filter((t) => t.closed).length;

  const refresh = () => setVersion((v) => v + 1);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || (!body.trim() && !image)) return;
    addMessage(email, "admin", body, image);
    setBody("");
    setImage(undefined);
    setSent(true);
    refresh();
    setTimeout(() => setSent(false), 2500);
  };

  return (
    <div>
      <div className="mb-5 rounded-xl border border-violet/30 bg-violet-soft p-4 text-sm text-violet">
        Тикеты реально сохраняются и показываются в личном кабинете — но только в этом же
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
            {knownEmails.map((e) => (
              <option key={e} value={e} />
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-display text-base text-ink-900">Тикеты</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter("open")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "open" ? "bg-ink-900 text-white" : "border border-line text-ink-900"
            }`}
          >
            Открытые ({openCount})
          </button>
          <button
            onClick={() => setFilter("closed")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "closed" ? "bg-ink-900 text-white" : "border border-line text-ink-900"
            }`}
          >
            Закрытые ({closedCount})
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "all" ? "bg-ink-900 text-white" : "border border-line text-ink-900"
            }`}
          >
            Все
          </button>
        </div>
      </div>

      {filteredThreads.length === 0 && (
        <p className="text-sm text-muted">Здесь пока пусто.</p>
      )}
      <div className="space-y-4">
        {filteredThreads.map((t) => (
          <ThreadCard
            key={t.email}
            thread={t}
            onReply={(addr) => setEmail(addr)}
            onToggleClosed={(addr, closed) => {
              setThreadClosed(addr, closed);
              refresh();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ThreadCard({
  thread,
  onReply,
  onToggleClosed,
}: {
  thread: SupportThread;
  onReply: (email: string) => void;
  onToggleClosed: (email: string, closed: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const last = thread.messages[thread.messages.length - 1];

  return (
    <div
      className={`rounded-2xl border p-5 ${
        !thread.closed ? "border-green-300 bg-green-50" : "border-line bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-ink-900">{thread.email}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                !thread.closed ? "bg-green-600 text-white" : "bg-ink-900/10 text-ink-900/60"
              }`}
            >
              {!thread.closed ? "Открыт" : "Закрыт"}
            </span>
          </div>
          <p className="text-xs text-muted">
            {thread.messages.length} сообщений · последнее {formatDateTime(thread.lastAt)} от{" "}
            {last.from === "admin" ? "поддержки" : "пользователя"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onReply(thread.email)}
            className="rounded-full border border-ink-900/20 px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-soft"
          >
            Ответить
          </button>
          <button
            onClick={() => onToggleClosed(thread.email, !thread.closed)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              !thread.closed
                ? "border border-red-200 text-red-600 hover:bg-red-50"
                : "border border-ink-900/20 text-ink-900 hover:bg-soft"
            }`}
          >
            {!thread.closed ? "Закрыть тикет" : "Открыть тикет"}
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
