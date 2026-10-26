// Чистая логика удаления неактивных аккаунтов (без базы и почты) — её проверяют тесты.

export const INACTIVE_DAYS = 30;
export const WARN_DAYS_BEFORE = 7;
export const MIN_DAYS_AFTER_WARNING = 3;
export const DAY = 86400000;

export interface InactivityCandidate {
  id: string;
  email: string;
  lastActiveAt: Date;
  inactivityWarnedAt: Date | null;
  subscription: { planId: string; status: string; currentPeriodEnd: Date | null } | null;
}

export type InactivityAction = "keep" | "warn" | "delete";

/** Платный доступ ещё действует — такой аккаунт не трогаем, даже если пользователь давно не заходил. */
export function hasPaidAccess(sub: InactivityCandidate["subscription"], now: Date): boolean {
  if (!sub || sub.planId === "trial") return false;
  return Boolean(sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > now.getTime());
}

export function decideInactivityAction(u: InactivityCandidate, now: Date): InactivityAction {
  if (hasPaidAccess(u.subscription, now)) return "keep";
  const idleDays = (now.getTime() - u.lastActiveAt.getTime()) / DAY;
  if (idleDays < INACTIVE_DAYS - WARN_DAYS_BEFORE) return "keep";
  if (!u.inactivityWarnedAt) return "warn";
  const afterWarnDays = (now.getTime() - u.inactivityWarnedAt.getTime()) / DAY;
  // письмо было отправлено уже после последней активности, и прошло достаточно времени
  if (idleDays >= INACTIVE_DAYS && afterWarnDays >= MIN_DAYS_AFTER_WARNING && u.inactivityWarnedAt >= u.lastActiveAt) return "delete";
  return "keep";
}

