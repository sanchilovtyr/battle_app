import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isBehaviorPath, isBotUserAgent, normalizePath, sanitizeClicks, validDevice } from "@/lib/analyticsCore";
import { recordBehavior } from "@/lib/analyticsStore";

export const dynamic = "force-dynamic";

/** Клики и глубина прокрутки для карт. Сохраняются только счётчиками — без привязки к человеку. */
export async function POST(req: Request) {
  const done = () => new NextResponse(null, { status: 204 });
  try {
    if (isBotUserAgent(req.headers.get("user-agent"))) return done();
    if (!checkRateLimit(`track-beh:${getClientIp(req)}`, 90, 60_000)) return done();
    const text = await req.text();
    if (text.length > 20_000) return done();
    const body = JSON.parse(text);
    const path = normalizePath(body?.path);
    if (!path || !isBehaviorPath(path) || !validDevice(body?.device)) return done();
    const clicks = sanitizeClicks(body.clicks);
    const sb = Number(body.scroll);
    const scrollBucket = body.scroll === null || body.scroll === undefined || !Number.isFinite(sb) ? null : Math.min(10, Math.max(0, Math.floor(sb)));
    if (!clicks.length && scrollBucket === null) return done();
    await recordBehavior({ path, device: body.device, clicks, scrollBucket });
  } catch (e) {
    console.error("Карты: не удалось записать поведение", (e as Error)?.message);
  }
  return done();
}
