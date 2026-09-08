import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sendRegistrationEmail } from "@/lib/mailer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
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

  // Письмо не должно блокировать регистрацию — если SMTP не настроен или
  // временно недоступен, пользователь всё равно должен успешно зарегистрироваться
  try {
    await sendRegistrationEmail(email);
    console.log(`Письмо о регистрации отправлено на ${email}`);
  } catch (e) {
    console.error("Не удалось отправить письмо о регистрации", e);
  }

  return NextResponse.json({ ok: true });
}
