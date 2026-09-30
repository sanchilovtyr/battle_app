import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const businessId = new URL(req.url).searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "Не указан businessId" }, { status: 400 });
  }

  const record = await prisma.metrikaConnection.findUnique({
    where: { userId_businessId: { userId: user.id, businessId } },
    select: {
      counterId: true,
      counterName: true,
      leadsGoalId: true,
      salesGoalId: true,
    },
  });

  if (!record) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    counterId: record.counterId,
    counterName: record.counterName,
    leadsGoalId: record.leadsGoalId,
    salesGoalId: record.salesGoalId,
  });
}
