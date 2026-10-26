import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { getCurrentUser } from "@/lib/session";
import { deviceFromWidth, isBehaviorPath, isBotUserAgent, normalizePath, validId } from "@/lib/analyticsCore";
import { getSettings, recordHit } from "@/lib/analyticsStore";

export const dynamic = "force-dynamic";

const PARAM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "yclid", "gclid"] as const;

function ownHosts(req: Request): string[] {
  const hosts = new Set<string>();
  try {
    if (process.env.NEXTAUTH_URL) hosts.add(new URL(process.env.NEXTAUTH_URL).hostname);
  } catch {
    /* адрес не задан */
  }
  const h = req.headers.get("host");
  if (h) hosts.add(h.split(":")[0]);
  hosts.add("m-navi.ru");
  return Array.from(hosts);
}

/** Приём просмотра страницы от счётчика на сайте. Счётчик не должен влиять на работу страниц: при любой ошибке ответ «не записывать». */
export async function POST(req: Request) {
  const empty = () => NextResponse.json({ rec: false });
  try {
    if (isBotUserAgent(req.headers.get("user-agent"))) return empty();
    if (!checkRateLimit(`track:${getClientIp(req)}`, 120, 60_000)) return empty();

    const body = await req.json().catch(() => null);
    if (!body || !validId(body.vid) || !validId(body.sid)) return empty();
    const path = normalizePath(body.path);
    if (!path) return empty();

    const params: Record<string, string> = {};
    const raw = body.params && typeof body.params === "object" ? body.params : {};
    for (const k of PARAM_KEYS) if (typeof raw[k] === "string") params[k] = raw[k].slice(0, 200);

    let userId: string | null = null;
    try {
      const u = await getCurrentUser();
      userId = (u as { id?: string } | null)?.id ?? null;
    } catch {
      userId = null;
    }

    // Запись сессии для вебвизора: только анонимные посетители на публичных страницах и только если включено
    let record = false;
    if (body.isNew === true && !userId && isBehaviorPath(path)) {
      const st = await getSettings();
      record = st.replayEnabled && Math.random() * 100 < st.replayPercent;
    }
    const width = Number(body.w);

    const res = await recordHit({
      vid: body.vid,
      sid: body.sid,
      path,
      referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null,
      params,
      ownHosts: ownHosts(req),
      isNewSession: body.isNew === true,
      userId,
      device: deviceFromWidth(width),
      record,
    });
    return NextResponse.json({ rec: res.recorded && !userId && isBehaviorPath(path) });
  } catch (e) {
    // таблиц может ещё не быть (до npx prisma db push) — просто молча пропускаем
    console.error("Аналитика: не удалось записать визит", (e as Error)?.message);
  }
  return empty();
}
