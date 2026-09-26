"use client";

import { useState } from "react";

export default function ContactSection() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось отправить заявку, попробуйте ещё раз.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Не удалось связаться с сервером, попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-8 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-violet-soft text-violet">
          ✓
        </div>
        <h3 className="font-display text-lg text-ink-900 mb-1.5">Заявка отправлена</h3>
        <p className="text-sm text-muted">
          Мы ответим на {contact || "указанный контакт"} в ближайшее время.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto grid max-w-md gap-3">
      <input
        type="text"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Как вас зовут"
        className="w-full rounded-xl border border-line bg-white p-3.5 text-ink-900 outline-none transition-colors focus:border-violet"
      />
      <input
        type="text"
        required
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="Email или телефон для ответа"
        className="w-full rounded-xl border border-line bg-white p-3.5 text-ink-900 outline-none transition-colors focus:border-violet"
      />
      <textarea
        required
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Какой у вас вопрос?"
        rows={4}
        className="w-full resize-none rounded-xl border border-line bg-white p-3.5 text-ink-900 outline-none transition-colors focus:border-violet"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-ink-900 px-5 py-3.5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 hover:bg-ink-800 disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {submitting ? "Отправляем…" : "Отправить"}
      </button>
    </form>
  );
}
