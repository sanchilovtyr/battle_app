import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rateLimit";
import { offersForCode } from "@/lib/promo";

export const dynamic = "force-dynamic";

/** Проверка промокода до оплаты: цена со скидкой для каждого тарифа, на который код действует. Лимит попыток защищает от подбора кодов. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return NextResponse.json({ error: "Сначала войдите или зарегистрируйтесь, чтобы применить промокод" }, { status: 401 });
  if (!checkRateLimit(`promo-check:${user.id}`, 15, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте через несколько минут." }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const res = await offersForCode(user.id, body.code).catch(() => null);
  if (!res) return NextResponse.json({ error: "Не удалось проверить промокод. Попробуйте позже." }, { status: 500 });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ ok: true, code: res.code, percent: res.percent, offers: res.offers });
}
