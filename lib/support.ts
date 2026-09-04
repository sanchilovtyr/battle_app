const MESSAGES_KEY = "promoplan_support_messages";

export interface SupportMessage {
  id: string;
  email: string; // с каким пользователем связано сообщение
  from: "user" | "admin";
  body: string;
  imageDataUrl?: string;
  createdAt: string;
}

export interface SupportThread {
  email: string;
  messages: SupportMessage[];
  lastAt: string;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // не критично для прототипа
  }
}

export function getAllMessages(): SupportMessage[] {
  const raw = safeGet(MESSAGES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SupportMessage[];
  } catch {
    return [];
  }
}

function saveAll(messages: SupportMessage[]) {
  safeSet(MESSAGES_KEY, JSON.stringify(messages));
}

export function addMessage(
  email: string,
  from: "user" | "admin",
  body: string,
  imageDataUrl?: string
): SupportMessage {
  const message: SupportMessage = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email: email.trim().toLowerCase(),
    from,
    body: body.trim(),
    ...(imageDataUrl ? { imageDataUrl } : {}),
    createdAt: new Date().toISOString(),
  };
  const all = [...getAllMessages(), message];
  saveAll(all);
  return message;
}

export function getThreadForEmail(email: string): SupportMessage[] {
  const target = email.trim().toLowerCase();
  return getAllMessages()
    .filter((m) => m.email === target)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function deleteThreadForEmail(email: string) {
  const target = email.trim().toLowerCase();
  const next = getAllMessages().filter((m) => m.email !== target);
  saveAll(next);
}

/** Группирует все сообщения по пользователю — для обзора в админке */
export function getThreads(): SupportThread[] {
  const all = getAllMessages();
  const map = new Map<string, SupportMessage[]>();
  for (const m of all) {
    const list = map.get(m.email) ?? [];
    list.push(m);
    map.set(m.email, list);
  }
  const threads: SupportThread[] = Array.from(map.entries()).map(([email, messages]) => {
    const sorted = [...messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return { email, messages: sorted, lastAt: sorted[sorted.length - 1].createdAt };
  });
  return threads.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
}
