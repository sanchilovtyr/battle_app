import { NextResponse } from "next/server";
import { sendContactFormEmail } from "@/lib/mailer";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const MAX_NAME = 200;
const MAX_CONTACT = 200;
const MAX_MESSAGE = 4000;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`contact:${ip}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Слишком много сообщений подряд. Попробуйте через несколько минут." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim().slice(0, MAX_NAME);
  const contact = String(body?.contact ?? "").trim().slice(0, MAX_CONTACT);
  const message = String(body?.message ?? "").trim().slice(0, MAX_MESSAGE);

  if (!name || !contact || !message) {
    return NextResponse.json({ error: "Заполните имя, контакт и сообщение" }, { status: 400 });
  }

  try {
    await sendContactFormEmail({ name, contact, message });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Не удалось отправить заявку с формы обратной связи", e);
    return NextResponse.json(
      { error: "Не удалось отправить заявку, попробуйте ещё раз или напишите нам напрямую" },
      { status: 500 }
    );
  }
}
