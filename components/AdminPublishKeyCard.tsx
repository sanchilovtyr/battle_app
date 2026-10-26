"use client";

import { useEffect, useState } from "react";

interface Status {
  set: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" }) : "—");

/** Ключ, по которому Claude (или другой помощник) может класть статьи в очередь отложенной публикации. */
export default function AdminPublishKeyCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [newKey, setNewKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = () =>
    fetch("/api/admin/publish-key")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {});
  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    if (status?.set && !confirm("Старый ключ перестанет работать. Выпустить новый?")) return;
    setBusy(true);
    const r = await fetch("/api/admin/publish-key", { method: "POST" });
    const d = await r.json().catch(() => null);
    setBusy(false);
    if (r.ok && d?.key) {
      setNewKey(d.key);
      setCopied(false);
      void load();
    }
  };
  const revoke = async () => {
    if (!confirm("Отозвать ключ? Автопубликация перестанет работать.")) return;
    setBusy(true);
    await fetch("/api/admin/publish-key", { method: "DELETE" });
    setBusy(false);
    setNewKey("");
    void load();
  };

  return (
    <details className="mb-6 rounded-xl border border-line bg-white p-4">
      <summary className="cursor-pointer text-sm font-medium text-ink-900">
        Ключ автопубликации {status?.set ? "· выпущен" : "· не выпущен"}
      </summary>
      <div className="mt-3 space-y-3 text-sm text-muted">
        <p>
          По этому ключу Claude может добавлять статьи в очередь: только с датой публикации не раньше чем через час (или черновиком).
          Сразу опубликовать, изменить или удалить уже существующую статью по ключу нельзя — всё, что он положил, видно здесь, в списке статей, и
          отменяется удалением.
        </p>
        {status?.set && (
          <p className="font-mono text-xs">
            Выпущен: {fmt(status.createdAt)} · последнее использование: {fmt(status.lastUsedAt)}
          </p>
        )}
        {newKey && (
          <div className="rounded-lg bg-brand-soft p-3">
            <p className="mb-2 text-xs text-ink-900">Скопируйте ключ сейчас — повторно он не показывается. Не отправляйте его в чат; вводите только туда, куда скажет инструкция.</p>
            <code className="block break-all rounded bg-white p-2 font-mono text-xs text-ink-900">{newKey}</code>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(newKey).then(() => setCopied(true));
              }}
              className="mt-2 rounded-full border border-ink-900/20 px-3 py-1.5 text-xs font-medium text-ink-900 hover:bg-ink-900 hover:text-white"
            >
              {copied ? "Скопировано" : "Копировать"}
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={create}
            disabled={busy}
            className="rounded-full bg-ink-900 px-4 py-2 text-xs font-medium text-white hover:bg-ink-800 disabled:opacity-50"
          >
            {status?.set ? "Выпустить новый ключ" : "Выпустить ключ"}
          </button>
          {status?.set && (
            <button
              onClick={revoke}
              disabled={busy}
              className="rounded-full border border-ink-900/20 px-4 py-2 text-xs font-medium text-ink-900 hover:bg-ink-900 hover:text-white disabled:opacity-50"
            >
              Отозвать
            </button>
          )}
        </div>
      </div>
    </details>
  );
}
