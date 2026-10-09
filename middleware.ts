import { NextRequest, NextResponse, NextFetchEvent } from "next/server";
import { detectBot } from "@/lib/bots";

/**
 * Узнаёт поисковых и ИИ-роботов по User-Agent и сообщает об их визите во внутренний
 * маршрут /api/internal/bot-hit (там запись в базу — в Edge Prisma недоступен).
 * Обычных посетителей не трогает: для них это одна проверка строки. Ответ сайта не задерживается.
 */

// Не чаще одного сообщения в минуту на бота и страницу — чтобы обход в сотни страниц не создавал лишней нагрузки
const lastReport = new Map<string, number>();
const THROTTLE_MS = 60_000;

export function middleware(req: NextRequest, event: NextFetchEvent) {
  const bot = detectBot(req.headers.get("user-agent"));
  if (!bot) return NextResponse.next();

  const secret = process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET;
  if (!secret) return NextResponse.next();

  const path = req.nextUrl.pathname;
  const key = `${bot.id}:${path}`;
  const now = Date.now();
  if (now - (lastReport.get(key) ?? 0) < THROTTLE_MS) return NextResponse.next();
  lastReport.set(key, now);
  if (lastReport.size > 2000) lastReport.clear();

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  const origin = process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : req.nextUrl.origin;

  event.waitUntil(
    fetch(`${origin}/api/internal/bot-hit`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify({ ua: req.headers.get("user-agent") || "", path, ip }),
    }).catch(() => {})
  );
  return NextResponse.next();
}

export const config = {
  // Страницы и служебные файлы для роботов. Статика, картинки, /api и админка не интересуют
  matcher: ["/((?!_next/|api/|admin|account|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|css|js|map|woff2?|ttf)$).*)"],
};
