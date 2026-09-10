import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

interface PaymentRow {
  amountKopecks: number;
  planId: string;
  createdAt: Date;
}

export async function GET() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const payments = (await prisma.payment.findMany({
    where: { status: "succeeded" },
    orderBy: { createdAt: "desc" },
    select: { amountKopecks: true, planId: true, createdAt: true },
  })) as PaymentRow[];

  const activeSubscribers = await prisma.subscription.count({
    where: { status: "active", planId: { not: "trial" } },
  });

  return NextResponse.json({
    payments: payments.map((p) => ({
      amountKopecks: p.amountKopecks,
      planId: p.planId,
      createdAt: p.createdAt,
    })),
    activeSubscribers,
  });
}
