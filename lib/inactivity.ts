// Удаление неактивных аккаунтов. Аккаунт считается неактивным, если пользователь
// 30 дней не входил и не работал в личном кабинете. За 7 дней до удаления на почту
// уходит предупреждение; удаляем не раньше, чем через 3 дня после письма. Аккаунты
// с действующей платной подпиской не удаляются никогда.

import { prisma } from "./db";
import { sendInactivityWarningEmail } from "./mailer";

import { INACTIVE_DAYS, WARN_DAYS_BEFORE, MIN_DAYS_AFTER_WARNING, DAY, decideInactivityAction, type InactivityCandidate } from "./inactivityCore";
export * from "./inactivityCore";

/** Не пишем в базу чаще, чем раз в 6 часов на пользователя */
const TOUCH_INTERVAL_MS = 6 * 3600 * 1000;

/** Отмечает активность пользователя (вход, работа в ЛК) и снимает предупреждение. Не бросает ошибок. */
export async function touchActivity(userId: string, now = new Date()): Promise<void> {
  try {
    await prisma.user.updateMany({
      where: { id: userId, lastActiveAt: { lt: new Date(now.getTime() - TOUCH_INTERVAL_MS) } },
      data: { lastActiveAt: now, inactivityWarnedAt: null },
    });
  } catch {
    // активность — вспомогательная отметка, не должна ломать основной запрос
  }
}

export interface CleanupResult {
  checked: number;
  warned: number;
  deleted: number;
  warnFailed: number;
}

export async function runInactivityCleanup(now = new Date()): Promise<CleanupResult> {
  const threshold = new Date(now.getTime() - (INACTIVE_DAYS - WARN_DAYS_BEFORE) * DAY);
  const users: InactivityCandidate[] = await prisma.user.findMany({
    where: { lastActiveAt: { lt: threshold } },
    select: { id: true, email: true, lastActiveAt: true, inactivityWarnedAt: true, subscription: { select: { planId: true, status: true, currentPeriodEnd: true } } },
  });
  const result: CleanupResult = { checked: users.length, warned: 0, deleted: 0, warnFailed: 0 };

  for (const u of users) {
    const action = decideInactivityAction(u, now);
    if (action === "warn") {
      const deleteOn = new Date(Math.max(u.lastActiveAt.getTime() + INACTIVE_DAYS * DAY, now.getTime() + MIN_DAYS_AFTER_WARNING * DAY));
      try {
        await sendInactivityWarningEmail(u.email, deleteOn);
        await prisma.user.update({ where: { id: u.id }, data: { inactivityWarnedAt: now } });
        result.warned++;
      } catch (e) {
        // не смогли предупредить — не удаляем
        console.error("Неактивные аккаунты: не удалось отправить предупреждение", e);
        result.warnFailed++;
      }
    } else if (action === "delete") {
      // Подписка, бизнесы, сообщения поддержки и платежи удаляются каскадно
      await prisma.user.delete({ where: { id: u.id } });
      result.deleted++;
    }
  }
  return result;
}
