import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { isBotUserAgent, validId } from "@/lib/analyticsCore";
import { recordEngagement } from "@/lib/analyticsStore";

export const dynamic = "force-dynamic";

/** Время, которое посетитель действительно провёл на странице (вкладка открыта и видна). По нему считаются отказы. Всегда отвечает «ок»: счётчик не должен влиять на сайт. */
export async function POST(req: Request) {
  try {
    if (isBotUserAgent(req.headers.get("user-agent"))) return NextResponse.json({ ok: true });
    if (!checkRateLimit(`engage:${getClientIp(req)}`, 240, 60_000)) return NextResponse.json({ ok: true });
    const body = await req.json().catch(() => null);
    if (!body || !validId(body.vid) || !validId(body.sid)) return NextResponse.json({ ok: true });
    const sec = Number(body.sec);
    if (!Number.isFinite(sec) || sec <= 0) return NextResponse.json({ ok: true });
    await recordEngagement(body.vid, body.sid, sec);
  } catch (e) {
    console.error("Аналитика: не удалось записать время на странице", (e as Error)?.message);
  }
  return NextResponse.json({ ok: true });
}
