"use client";

import { useEffect, useState } from "react";
import { fetchMyThread, importLegacyMessages, sendUserMessage, SupportMessage } from "@/lib/support";
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
  const [closed, setClosed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | undefined>(undefined);
  const [sent, setSent] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const refresh = async () => {
    try {
      const r = await fetchMyThread();
      setThread(r.messages);
      setClosed(r.closed);
    } catch {
      // нет сети — оставляем то, что уже показано
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      await importLegacyMessages(email); // старые сообщения из браузера → на сервер (один раз)
      if (alive) await refresh();
    })();
    // подхватываем ответ поддержки, пока вкладка открыта
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!body.trim() && !image) || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendUserMessage(body, image);
      await refresh();
      setExpanded(true);
      setBody("");
      setImage(undefined);
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить");
    } finally {
      setSending(false);
    }
  };

  const last = thread[thread.length - 1];

  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <h2 className="mb-4 font-display text-lg text-ink-900">Техподдержка</h2>

      {thread.length > 0 && (
        <div
          className={`mb-5 rounded-xl border p-4 ${
            !closed ? "border-green-300 bg-green-50" : "border-line bg-soft"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  !closed ? "bg-green-600 text-white" : "bg-ink-900/10 text-ink-900/60"
                }`}
              >
                {!closed ? "Тикет открыт" : "Тикет закрыт"}
              </span>
              <span className="text-xs text-muted">
                Последнее сообщение {formatDateTime(last.createdAt)}
              </span>
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-sm text-violet underline underline-offset-4"
            >
              {expanded ? "Скрыть переписку" : "Показать переписку"}
            </button>
          </div>

          {expanded && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
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
                  {m.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.imageUrl}
                      alt="Вложение"
                      className={`max-h-64 rounded-lg ${m.body ? "mt-2" : ""}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={send} className="grid gap-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            closed
              ? "Опишите новый вопрос — это снова откроет тикет"
              : "Опишите вопрос — ответим на этот email"
          }
          rows={3}
          className="w-full resize-none rounded-xl border border-line p-3.5 text-sm outline-none focus:border-violet"
        />
        <ImageAttachField value={image} onChange={setImage} />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={sending}
            className="rounded-full bg-ink-900 disabled:opacity-50 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-ink-800"
          >
            {sending ? "Отправляем…" : "Отправить в поддержку"}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
          {sent && <span className="text-sm text-violet">Отправлено</span>}
        </div>
      </form>
    </section>
  );
}
