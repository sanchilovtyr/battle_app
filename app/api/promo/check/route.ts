import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rateLimit";
import { checkPromoForUser } from "@/lib/promo";
import { PROMO_PLAN_ID, promoSummary } from "@/lib/promoCore";
import { getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

/** Проверка промокода до оплаты: показывает цену со скидкой. Лимит попыток — защита от подбора кодов. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return NextResponse.json({ error: "Сначала войдите или зарегистрируйтесь, чтобы применить промокод" }, { status: 401 });
  if (!checkRateLimit(`promo-check:${user.id}`, 15, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Слишком много попыток. Попробуйте через несколько минут." }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const check = await checkPromoForUser(user.id, body.code, PROMO_PLAN_ID).catch(() => null);
  if (!check) return NextResponse.json({ error: "Не удалось проверить промокод. Попробуйте позже." }, { status: 500 });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });
  const plan = getPlan(PROMO_PLAN_ID);
  return NextResponse.json({
    ok: true,
    code: check.promo.code,
    percent: check.promo.percent,
    planId: PROMO_PLAN_ID,
    originalRub: check.price.originalRub,
    finalRub: check.price.finalRub,
    free: check.price.free,
    text: promoSummary(check.price, check.promo.percent, `${plan.price}`),
  });
}
