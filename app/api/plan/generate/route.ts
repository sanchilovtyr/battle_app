import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { generatePlanForAnswers } from "@/lib/planGenerator";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { Answers } from "@/lib/types";

const BUSINESS_TYPES = ["retail", "services", "horeca", "b2b", "online_edu", "ecommerce", "other"];
const BUDGETS = ["under20", "20to100", "100to500", "over500"];
const GOALS = ["awareness", "leads", "sales_online", "repeat_sales"];
const GEOS = ["local", "regional", "national"];
const EXPERIENCES = ["beginner", "middle", "advanced"];

function isValidAnswers(a: unknown): a is Answers {
  if (!a || typeof a !== "object") return false;
  const x = a as Record<string, unknown>;
  return (
    BUSINESS_TYPES.includes(x.businessType as string) &&
    (x.hasSite === undefined || typeof x.hasSite === "boolean") &&
    (x.hasSocial === undefined || typeof x.hasSocial === "boolean") &&
    GOALS.includes(x.goal as string) &&
    BUDGETS.includes(x.budget as string) &&
    GEOS.includes(x.geo as string) &&
    (x.experience === undefined || EXPERIENCES.includes(x.experience as string))
  );
}

export async function POST(req: Request) {
  // Анкету и генерацию плана можно проходить без регистрации — она нужна
  // только чтобы сохранить готовый план и открыть его целиком (см. лендинг).
  // Поэтому лимитируем по пользователю, если он вошёл, и по IP — если нет,
  // чтобы анонимный доступ нельзя было использовать для перебора/нагрузки.
  const user = await getCurrentUser();
  const rateLimitKey = user ? `plan-generate:${user.id}` : `plan-generate-anon:${getClientIp(req)}`;
  const rateLimitMax = user ? 20 : 8;

  if (!checkRateLimit(rateLimitKey, rateLimitMax, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Слишком много запросов подряд" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  if (!isValidAnswers(body?.answers)) {
    return NextResponse.json({ error: "Некорректные ответы анкеты" }, { status: 400 });
  }

  try {
    const plan = await generatePlanForAnswers(body.answers);
    return NextResponse.json({ plan });
  } catch (e) {
    console.error("Не удалось сгенерировать план", e);
    return NextResponse.json({ error: "Не удалось сгенерировать план" }, { status: 500 });
  }
}
