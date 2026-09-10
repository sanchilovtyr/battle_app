import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { generatePlanForAnswers } from "@/lib/planGenerator";
import { checkRateLimit } from "@/lib/rateLimit";
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
    typeof x.hasSite === "boolean" &&
    typeof x.hasSocial === "boolean" &&
    GOALS.includes(x.goal as string) &&
    BUDGETS.includes(x.budget as string) &&
    GEOS.includes(x.geo as string) &&
    EXPERIENCES.includes(x.experience as string)
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (!checkRateLimit(`plan-generate:${user.id}`, 20, 10 * 60 * 1000)) {
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
