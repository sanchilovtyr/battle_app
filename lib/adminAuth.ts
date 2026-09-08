import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE_NAME = "admin_session";
const SESSION_HOURS = 12;

function getSigningSecret(): string {
  // Подписываем токен секретом NextAuth — он уже обязателен для работы приложения,
  // отдельный секрет заводить не нужно
  return process.env.NEXTAUTH_SECRET || "";
}

export function createAdminToken(): string {
  const expires = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = `admin:${expires}`;
  const signature = createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token) return false;
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
