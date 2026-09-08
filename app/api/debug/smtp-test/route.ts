import { NextResponse } from "next/server";
import { connect } from "net";
import { sendMail } from "@/lib/mailer";

// Временная диагностика: открыть в браузере
// https://ваш-домен/api/debug/smtp-test?secret=ЗНАЧЕНИЕ_CRON_SECRET
// Защищено тем же CRON_SECRET, что уже есть в переменных — отдельный секрет не нужен.
// После того как проблему с почтой найдём — этот файл стоит удалить.

function checkTcp(host: string, port: number, timeoutMs = 8000): Promise<{ ok: boolean; ms: number; error?: string }> {
  const started = Date.now();
  return new Promise((resolve) => {
    const socket = connect({ host, port, timeout: timeoutMs });
    const finish = (ok: boolean, error?: string) => {
      socket.destroy();
      resolve({ ok, ms: Date.now() - started, error });
    };
    socket.on("connect", () => finish(true));
    socket.on("timeout", () => finish(false, `таймаут ${timeoutMs}мс`));
    socket.on("error", (e) => finish(false, e.message));
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  // Три параллельные проверки: сама почта на двух портах + контрольный внешний хост,
  // который точно должен быть доступен, если исходящие соединения вообще работают
  const [port587, port465, control] = await Promise.all([
    checkTcp("smtp.timeweb.ru", 587),
    checkTcp("smtp.timeweb.ru", 465),
    checkTcp("google.com", 443),
  ]);

  const result: Record<string, unknown> = {
    tcp: {
      "smtp.timeweb.ru:587": port587,
      "smtp.timeweb.ru:465": port465,
      "google.com:443 (контроль)": control,
    },
  };

  // Если TCP хотя бы до одного порта достучался — пробуем реальную отправку письма через него
  if (port587.ok || port465.ok) {
    const started = Date.now();
    try {
      await sendMail({ to: process.env.SMTP_USER || "", subject: "Диагностика SMTP", html: "Тест" });
      result.mailSend = { ok: true, tookMs: Date.now() - started };
    } catch (e) {
      result.mailSend = {
        ok: false,
        tookMs: Date.now() - started,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return NextResponse.json(result);
}
