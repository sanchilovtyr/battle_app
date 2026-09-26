import { randomBytes, createHash } from "crypto";
import { prisma } from "./db";

const TOKEN_TTL_MS = 60 * 60 * 1000; // ссылка живёт 1 час

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Создаёт новую ссылку восстановления и гасит все прежние неиспользованные —
 *  чтобы за раз действовала только последняя отправленная пользователю ссылка. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  await prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } });

  const raw = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return raw;
}

type ConsumeResult =
  | { error: "invalid" | "used" | "expired" }
  | { tokenId: string; user: { id: string; email: string } };

export async function consumePasswordResetToken(raw: string): Promise<ConsumeResult> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });

  if (!record) return { error: "invalid" };
  if (record.usedAt) return { error: "used" };
  if (record.expiresAt.getTime() < Date.now()) return { error: "expired" };

  return { tokenId: record.id, user: { id: record.user.id, email: record.user.email } };
}

export async function markPasswordResetTokenUsed(tokenId: string) {
  await prisma.passwordResetToken.update({ where: { id: tokenId }, data: { usedAt: new Date() } });
}
