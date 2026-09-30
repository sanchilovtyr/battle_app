import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createPasswordResetToken } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`forgot-password:${ip}`, 8, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Слишком много запросов подряд. Попробуйте позже." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
  }

  // Лимит ещё и по конкретному адресу — иначе почтовый ящик другого человека
  // можно засыпать письмами, каждый раз меняя IP
  if (!checkRateLimit(`forgot-password-email:${email}`, 3, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Слишком много запросов подряд. Попробуйте позже." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Не показываем, зарегистрирован ли этот email — иначе форму можно
  // использовать, чтобы проверять чужие адреса на сервисе
  if (user) {
    try {
      const rawToken = await createPasswordResetToken(user.id);
      const siteUrl = process.env.NEXTAUTH_URL || "";
      const resetUrl = `${siteUrl}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(email, resetUrl);
    } catch (e) {
      console.error("Не удалось отправить письмо восстановления пароля", e);
    }
  }

  return NextResponse.json({ ok: true });
}
