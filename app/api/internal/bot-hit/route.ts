import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { detectBot, VERIFY_SUFFIXES } from "@/lib/bots";

export const dynamic = "force-dynamic";

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Обратный DNS: IP → имя хоста робота → тот же IP. Так отличают настоящий Googlebot/YandexBot от подделки по User-Agent */
async function verifyIp(botId: string, ip: string): Promise<boolean> {
  const suffixes = VERIFY_SUFFIXES[botId];
  if (!suffixes || !ip) return false;
  try {
    const dns = await import("dns/promises");
    const withTimeout = <T,>(p: Promise<T>) =>
      Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("dns timeout")), 3000))]);
    const hosts = await withTimeout(dns.reverse(ip));
    for (const host of hosts) {
      if (!suffixes.some((s) => host.toLowerCase().endsWith(s))) continue;
      const back = await withTimeout(dns.lookup(host, { all: true }));
      if (back.some((r) => r.address === ip)) return true;
    }
  } catch {
    // DNS недоступен — считаем визит неподтверждённым, но не теряем его
  }
  return false;
}

/** Вызывается только из middleware этого же сервера (секрет в заголовке) */
export async function POST(req: Request) {
  const secret = process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET;
  const got = req.headers.get("x-internal-secret") || "";
  if (!secret || !sameSecret(got, secret)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { ua?: string; path?: string; ip?: string };
  const bot = detectBot(body.ua);
  if (!bot) return NextResponse.json({ ok: false });

  const now = new Date();
  const path = String(body.path || "").slice(0, 300);
  const verified = bot.kind === "search" ? await verifyIp(bot.id, String(body.ip || "")) : false;

  try {
    await prisma.botVisit.upsert({
      where: { bot: bot.id },
      create: { bot: bot.id, kind: bot.kind, lastSeenAt: now, lastPath: path, lastVerifiedAt: verified ? now : null },
      update: { lastSeenAt: now, lastPath: path, ...(verified ? { lastVerifiedAt: now } : {}) },
    });
  } catch (e) {
    console.error("bot-hit: не удалось записать визит (нужен prisma db push?)", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
