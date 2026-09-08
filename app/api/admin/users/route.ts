import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";

interface UserWithSubscription {
  id: string;
  email: string;
  name: string;
  phone: string;
  createdAt: Date;
  subscription: { planId: string; status: string } | null;
}

export async function GET() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const users = (await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { subscription: true },
  })) as UserWithSubscription[];

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      createdAt: u.createdAt,
      planId: u.subscription?.planId ?? "trial",
      status: u.subscription?.status ?? "active",
    })),
  });
}
