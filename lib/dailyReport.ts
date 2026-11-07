import { prisma } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { DailyData, buildDailyMessage, mskDayWindow } from "@/lib/dailyReportCore";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("Не заданы TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    // Токен в ошибку не включаем
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram ответил ${res.status}: ${body.slice(0, 200)}`);
  }
}

export async function collectDaily(from: Date, to: Date): Promise<DailyData> {
  const sessions = await db.analyticsSession.findMany({
    where: { startedAt: { gte: from, lt: to } },
    select: { visitorId: true, channel: true, startedAt: true },
    take: 300000,
  });
  const payments = await prisma.payment.findMany({
    where: { status: "succeeded", createdAt: { gte: from, lt: to } },
    select: { planId: true, amountKopecks: true },
  });
  const users = await prisma.user.findMany({
    where: { createdAt: { gte: from, lt: to } },
    select: { subscription: { select: { planId: true } } },
  });
  return {
    sessions,
    payments,
    newUsers: users.map((u: { subscription: { planId: string } | null }) => ({ planId: u.subscription?.planId ?? "trial" })),
  };
}

export async function sendDailyReport(dateStr?: string | null, dryRun = false): Promise<{ text: string; sent: boolean }> {
  const win = mskDayWindow(new Date(), dateStr);
  const data = await collectDaily(win.from, win.to);
  const text = buildDailyMessage(win.label, data, (id) => getPlan(id as never)?.name ?? id);
  if (!dryRun) await sendTelegram(text);
  return { text, sent: !dryRun };
}
