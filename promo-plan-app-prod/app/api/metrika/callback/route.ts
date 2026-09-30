import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { verifyState, exchangeCodeForToken } from "@/lib/yandexMetrika";
import { encryptSecret } from "@/lib/secretBox";

function redirectToBusiness(businessId: string, status: string) {
  const siteUrl = process.env.NEXTAUTH_URL || "";
  return NextResponse.redirect(`${siteUrl}/business/${businessId}?metrika=${status}`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateToken = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const state = verifyState(stateToken);

  if (oauthError || !code || !state) {
    // Без валидного state некуда даже вернуть пользователя с понятной ошибкой —
    // отправляем на личный кабинет
    const siteUrl = process.env.NEXTAUTH_URL || "";
    return NextResponse.redirect(`${siteUrl}/account?metrika=error`);
  }

  const user = await getCurrentUser();
  if (!user?.id || user.id !== state.userId) {
    return redirectToBusiness(state.businessId, "error");
  }

  try {
    const { accessToken, refreshToken } = await exchangeCodeForToken(code);

    await prisma.metrikaConnection.upsert({
      where: { userId_businessId: { userId: user.id, businessId: state.businessId } },
      update: {
        accessToken: encryptSecret(accessToken),
        refreshToken: refreshToken ? encryptSecret(refreshToken) : null,
        counterId: null,
        counterName: null,
        leadsGoalId: null,
        salesGoalId: null,
      },
      create: {
        userId: user.id,
        businessId: state.businessId,
        accessToken: encryptSecret(accessToken),
        refreshToken: refreshToken ? encryptSecret(refreshToken) : null,
      },
    });

    return redirectToBusiness(state.businessId, "connected");
  } catch (e) {
    console.error("Не удалось завершить подключение Яндекс Метрики", e);
    return redirectToBusiness(state.businessId, "error");
  }
}
