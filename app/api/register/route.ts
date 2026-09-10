import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendRegistrationEmail, sendAdminNewUserNotification } from "@/lib/mailer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`register:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Слишком много попыток регистрации. Попробуйте позже." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Пароль должен быть не короче 6 символов" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Этот email уже зарегистрирован" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      subscription: { create: { planId: "trial", status: "active" } },
    },
  });

  // Письма отправляем в фоне, не дожидаясь их результата — иначе зависший
  // или медленный SMTP-сервер завесил бы весь ответ на регистрацию.
  // Ошибки всё равно логируются, просто уже после того как пользователь
  // получил ответ "регистрация прошла успешно"
  sendRegistrationEmail(email)
    .then(() => console.log(`Письмо о регистрации отправлено на ${email}`))
    .catch((e) => console.error("Не удалось отправить письмо о регистрации", e));

  sendAdminNewUserNotification(email).catch((e) =>
    console.error("Не удалось отправить уведомление админу о новой регистрации", e)
  );

  return NextResponse.json({ ok: true });
}
