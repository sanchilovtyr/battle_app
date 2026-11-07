import { createHash } from "crypto";

/** Минимальная длина NEXTAUTH_SECRET. Короче — считаем секрет не заданным. */
export const MIN_SECRET_LENGTH = 16;

/**
 * Секрет подписи/шифрования. Если он не задан или слишком короткий — бросаем ошибку
 * (fail-closed): раньше пустая строка молча становилась ключом, и по открытому
 * коду можно было подделать подпись админ-сессии.
 */
export function requireSecret(): string {
  const s = process.env.NEXTAUTH_SECRET || "";
  if (s.length < MIN_SECRET_LENGTH) {
    throw new Error("NEXTAUTH_SECRET не задан или короче 16 символов — задайте длинное случайное значение");
  }
  return s;
}

/** Секрет есть и достаточно длинный (без исключения) */
export function hasStrongSecret(): boolean {
  return (process.env.NEXTAUTH_SECRET || "").length >= MIN_SECRET_LENGTH;
}

/** Отпечаток пароля админки: при смене ADMIN_PASSWORD все выданные ранее сессии перестают действовать */
export function adminPasswordFingerprint(): string {
  const p = process.env.ADMIN_PASSWORD || "";
  return createHash("sha256").update("admin-pw:" + p).digest("hex").slice(0, 16);
}
