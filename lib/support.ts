// Клиентская часть техподдержки. Все сообщения живут на сервере (таблица
// SupportMessage), поэтому переписка одинаково видна с любого браузера и
// устройства — и пользователю, и админу.

import type { SupportMessage, SupportThread } from "./supportShared";
export type { SupportMessage, SupportThread } from "./supportShared";

const LEGACY_MESSAGES_KEY = "promoplan_support_messages";
const LEGACY_CLOSED_KEY = "promoplan_support_closed_threads";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Не удалось выполнить запрос");
  return data as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// ───── пользователь ─────

export async function fetchMyThread(): Promise<{ messages: SupportMessage[]; closed: boolean }> {
  return api("/api/support", { cache: "no-store" });
}

export async function sendUserMessage(body: string, image?: string): Promise<SupportMessage> {
  const r = await api<{ message: SupportMessage }>("/api/support", json("POST", { body, image }));
  return r.message;
}

/** Разово переносит на сервер сообщения, написанные до перехода на серверное хранение
 *  (лежали в localStorage). Берём только сообщения этого же email. */
export async function importLegacyMessages(email: string): Promise<number> {
  try {
    const raw = window.localStorage.getItem(LEGACY_MESSAGES_KEY);
    if (!raw) return 0;
    const all = JSON.parse(raw) as { email?: string; from?: string; body?: string; createdAt?: string }[];
    const mine = all.filter((m) => m.from === "user" && (m.email ?? "").toLowerCase() === email.trim().toLowerCase());
    let imported = 0;
    if (mine.length > 0) {
      const r = await api<{ imported: number }>("/api/support/import", json("POST", { messages: mine }));
      imported = r.imported;
    }
    window.localStorage.removeItem(LEGACY_MESSAGES_KEY);
    window.localStorage.removeItem(LEGACY_CLOSED_KEY);
    return imported;
  } catch {
    return 0;
  }
}

// ───── админ ─────

export async function fetchThreads(): Promise<SupportThread[]> {
  const r = await api<{ threads: SupportThread[] }>("/api/admin/support", { cache: "no-store" });
  return r.threads;
}

export async function sendAdminMessage(email: string, body: string, image?: string): Promise<void> {
  await api("/api/admin/support", json("POST", { email, body, image }));
}

export async function setThreadClosed(email: string, closed: boolean): Promise<void> {
  await api("/api/admin/support", json("PATCH", { email, closed }));
}
