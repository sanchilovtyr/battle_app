import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { signState, buildAuthorizeUrl } from "@/lib/yandexMetrika";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const businessId = new URL(req.url).searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "Не указан businessId" }, { status: 400 });
  }

  if (!process.env.YANDEX_METRIKA_CLIENT_ID) {
    return NextResponse.json(
      { error: "Интеграция с Метрикой не настроена на сервере (нет YANDEX_METRIKA_CLIENT_ID)" },
      { status: 500 }
    );
  }

  const state = signState({ userId: user.id, businessId });
  return NextResponse.redirect(buildAuthorizeUrl(state));
}
