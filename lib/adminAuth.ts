import { createHmac, timingSafeEqual } from "crypto";
import { requireSecret, hasStrongSecret, adminPasswordFingerprint } from "./secrets";

export const ADMIN_COOKIE_NAME = "admin_session";
const SESSION_HOURS = 12;

function getSigningSecret(): string {
  // Секрет NextAuth + отпечаток пароля админки: смена пароля гасит все старые сессии.
  // Пустой/короткий секрет — ошибка, а не «подпись пустым ключом»
  return requireSecret() + ":" + adminPasswordFingerprint();
}

export function createAdminToken(): string {
  if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD не задан");
  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = `admin:${expires}`;
  const signature = createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
  if (!hasStrongSecret() || !process.env.ADMIN_PASSWORD) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  } catch {
    return false;
  }

  const expires = Number(payload.split(":")[1]);
  return Number.isFinite(expires) && Date.now() < expires;
}
