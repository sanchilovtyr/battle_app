import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { computeEffectivePlanId } from "@/lib/subscriptionUtils";
import { getPlan } from "@/lib/plans";
import { generatePlanPdf } from "@/lib/pdfGenerator";
import { sendPlanPdfEmail } from "@/lib/mailer";
import { GeneratedPlan } from "@/lib/types";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const businessName = String(body?.businessName ?? "Мой бизнес").slice(0, 200);
  const plan = body?.plan as GeneratedPlan | undefined;

  if (!plan || !plan.foundation || !plan.traffic) {
    return NextResponse.json({ error: "Некорректные данные плана" }, { status: 400 });
  }

  // Доступ к этапу 3 определяем на сервере по реальной подписке — не доверяем
  // тому, что прислал клиент, иначе можно было бы получить закрытый этап в обход оплаты
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  const effectivePlanId = computeEffectivePlanId(
    sub
      ? { planId: sub.planId, status: sub.status, currentPeriodEnd: sub.currentPeriodEnd }
      : null
  );
  const includeRetention = getPlan(effectivePlanId).fullPlanAccess;

  try {
    const pdfBytes = await generatePlanPdf(businessName, plan, includeRetention);
    await sendPlanPdfEmail(user.email, businessName, pdfBytes);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Не удалось сформировать/отправить PDF плана", e);
    return NextResponse.json({ error: "Не удалось отправить PDF" }, { status: 500 });
  }
}
