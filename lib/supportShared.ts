// Общие типы и ограничения техподдержки — используются и сервером, и клиентом.

export const SUPPORT_MAX_BODY = 5000;
export const SUPPORT_MAX_IMPORT = 30;

export interface SupportMessage {
  id: string;
  email: string; // с каким пользователем связано сообщение
  from: "user" | "admin";
  body: string;
  /** Адрес картинки-вложения (скачивается с сервера), если она есть */
  imageUrl?: string;
  createdAt: string;
}

export interface SupportThread {
  email: string;
  messages: SupportMessage[];
  lastAt: string;
  closed: boolean;
}

export function imageEndpoint(id: string): string {
  return `/api/support/image/${id}`;
}

/** Строка из базы → сообщение для клиента. */
export function toClientMessage(
  m: { id: string; from: string; body: string; createdAt: Date; image?: unknown; hasImage?: boolean },
  email: string
): SupportMessage {
  const has = m.hasImage ?? Boolean(m.image);
  return {
    id: m.id,
    email,
    from: m.from === "admin" ? "admin" : "user",
    body: m.body,
    ...(has ? { imageUrl: imageEndpoint(m.id) } : {}),
    createdAt: m.createdAt.toISOString(),
  };
}
