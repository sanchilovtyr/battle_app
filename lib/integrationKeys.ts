// Ключи внешних сервисов (Яндекс Вебмастер, Google Search Console).
// Источник — таблица IntegrationKey (вводятся в админке, хранятся
// зашифрованно), запасной вариант — переменные окружения с теми же именами.

import { prisma } from "./db";
import { decryptSecret, encryptSecret } from "./secretBox";

export const KEY_NAMES = [
  "YANDEX_WEBMASTER_TOKEN",
  "YANDEX_WEBMASTER_HOST",
  "GOOGLE_SC_CLIENT_EMAIL",
  "GOOGLE_SC_PRIVATE_KEY",
  "GOOGLE_SC_SITE_URL",
] as const;
export type KeyName = (typeof KEY_NAMES)[number];

/** Какие значения безопасно показывать в интерфейсе целиком (остальные — только «задан / не задан»). */
const PUBLIC_KEYS: KeyName[] = ["YANDEX_WEBMASTER_HOST", "GOOGLE_SC_CLIENT_EMAIL", "GOOGLE_SC_SITE_URL"];

export type KeySource = "admin" | "env" | null;

export async function getKey(name: KeyName): Promise<{ value: string; source: KeySource }> {
  try {
    const row = await prisma.integrationKey.findUnique({ where: { name } });
    if (row?.value) return { value: decryptSecret(row.value), source: "admin" };
  } catch {
    // нет таблицы/расшифровки — пробуем окружение
  }
  const env = (process.env[name] ?? "").trim();
  return env ? { value: env, source: "env" } : { value: "", source: null };
}

export async function setKey(name: KeyName, value: string | null) {
  const v = (value ?? "").trim();
  if (!v) {
    await prisma.integrationKey.deleteMany({ where: { name } });
    return;
  }
  const enc = encryptSecret(v);
  await prisma.integrationKey.upsert({ where: { name }, create: { name, value: enc }, update: { value: enc } });
}

export interface KeyStatus {
  name: KeyName;
  set: boolean;
  source: KeySource;
  /** Значение — только для несекретных полей */
  value?: string;
}

export async function keyStatuses(): Promise<KeyStatus[]> {
  const out: KeyStatus[] = [];
  for (const name of KEY_NAMES) {
    const { value, source } = await getKey(name);
    out.push({ name, set: Boolean(value), source, ...(PUBLIC_KEYS.includes(name) && value ? { value } : {}) });
  }
  return out;
}
