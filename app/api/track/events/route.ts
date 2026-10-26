import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isBotUserAgent, validId } from "@/lib/analyticsCore";
import { REPLAY_MAX_CHUNK_BYTES, saveReplayChunk } from "@/lib/analyticsStore";

export const dynamic = "force-dynamic";

/** Куски записи сессии (вебвизор). Принимаются только для сессий, которым сервер разрешил запись. */
export async function POST(req: Request) {
  const done = () => new NextResponse(null, { status: 204 });
  try {
    if (isBotUserAgent(req.headers.get("user-agent"))) return done();
    if (!checkRateLimit(`track-ev:${getClientIp(req)}`, 60, 60_000)) return done();
    const len = Number(req.headers.get("content-length") || 0);
    if (len > REPLAY_MAX_CHUNK_BYTES) return done();
    const text = await req.text();
    if (text.length > REPLAY_MAX_CHUNK_BYTES) return done();
    const body = JSON.parse(text);
    if (!body || !validId(body.vid) || !validId(body.sid) || !Array.isArray(body.events) || body.events.length === 0 || body.events.length > 5000) return done();
    await saveReplayChunk(body.vid, body.sid, JSON.stringify(body.events));
  } catch (e) {
    console.error("Вебвизор: не удалось сохранить запись", (e as Error)?.message);
  }
  return done();
}
