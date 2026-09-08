import { NextResponse } from "next/server";
import { sendMail } from "@/lib/mailer";

// Временная диагностика: открыть в браузере
// https://ваш-домен/api/_debug/smtp-test?secret=ЗНАЧЕНИЕ_CRON_SECRET
// Защищено тем же CRON_SECRET, что уже есть в переменных — отдельный секрет не нужен.
// После того как проблему с почтой найдём — этот файл стоит удалить.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const to = process.env.SMTP_USER || "";
  const started = Date.now();

  // Подстраховка своим тайм-аутом поверх тайм-аутов nodemailer —
  // чтобы этот запрос точно не завис намертво, а всегда что-то ответил
  const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Таймаут ${ms}мс — соединение не отвечает`)), ms)
      ),
    ]);

  try {
    await withTimeout(
      sendMail({ to, subject: "Диагностика SMTP", html: "Тестовое письмо для проверки отправки" }),
      15000
    );
    return NextResponse.json({ ok: true, to, tookMs: Date.now() - started });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        to,
        tookMs: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
        env: {
          SMTP_HOST: process.env.SMTP_HOST || "(не задано)",
          SMTP_PORT: process.env.SMTP_PORT || "(не задано)",
          SMTP_USER: process.env.SMTP_USER ? "задано" : "(не задано)",
          SMTP_PASSWORD: process.env.SMTP_PASSWORD ? "задано" : "(не задано)",
        },
      },
      { status: 500 }
    );
  }
}
