import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    include: { subscription: true },
  });
  if (!full) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });

  return NextResponse.json({
    email: full.email,
    name: full.name,
    phone: full.phone,
    subscription: full.subscription
      ? {
          planId: full.subscription.planId,
          status: full.subscription.status,
          currentPeriodEnd: full.subscription.currentPeriodEnd,
          hasPaymentMethod: Boolean(full.subscription.paymentMethodId),
        }
      : null,
  });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.slice(0, 200) : undefined;
  const phone = typeof body.phone === "string" ? body.phone.slice(0, 50) : undefined;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { ...(name !== undefined ? { name } : {}), ...(phone !== undefined ? { phone } : {}) },
  });

  return NextResponse.json({ ok: true, name: updated.name, phone: updated.phone });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  // Subscription / Business / SupportMessage / Payment удалятся каскадно (onDelete: Cascade в schema.prisma)
  await prisma.user.delete({ where: { id: user.id } });

  return NextResponse.json({ ok: true });
}
