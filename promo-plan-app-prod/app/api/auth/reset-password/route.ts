import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { consumePasswordResetToken, markPasswordResetTokenUsed } from "@/lib/passwordReset";
import { sendPasswordChangedEmail } from "@/lib/mailer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Ссылка недействительна — запросите восстановление пароля заново",
  used: "Эта ссылка уже была использована — запросите новую",
  expired: "Ссылка устарела — запросите новую",
};

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Слишком много попыток подряд. Попробуйте позже." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");

  if (!token) {
    return NextResponse.json({ error: "Ссылка недействительна" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Пароль должен быть не короче 6 символов" }, { status: 400 });
  }

  const result = await consumePasswordResetToken(token);
  if ("error" in result) {
    return NextResponse.json({ error: ERROR_MESSAGES[result.error] }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: result.user.id }, data: { passwordHash } });
  await markPasswordResetTokenUsed(result.tokenId);

  sendPasswordChangedEmail(result.user.email).catch((e) =>
    console.error("Не удалось отправить письмо о смене пароля", e)
  );

  return NextResponse.json({ ok: true, email: result.user.email });
}
