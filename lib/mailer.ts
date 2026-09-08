import nodemailer from "nodemailer";

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST / SMTP_USER / SMTP_PASSWORD не заданы в переменных окружения");
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 — SSL с самого начала соединения; 587/2525 — STARTTLS
    auth: { user, pass },
  });

  return cachedTransporter;
}

export async function sendMail(params: { to: string; subject: string; html: string }) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
}

export async function sendRegistrationEmail(email: string) {
  const siteUrl = process.env.NEXTAUTH_URL || "";

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111525;">
      <h2 style="margin-bottom: 8px;">Регистрация подтверждена</h2>
      <p>Здравствуйте!</p>
      <p>
        Вы успешно зарегистрировались на сервисе «Ключевое слово» с email
        <b>${email}</b>. Вам подключён пробный тариф — можно сразу построить
        первый план продвижения.
      </p>
      <p>
        <a href="${siteUrl}/account" style="color: #7658F6;">Перейти в личный кабинет →</a>
      </p>
      <p style="color: #70758A; font-size: 13px; margin-top: 24px;">
        Если это были не вы — просто проигнорируйте это письмо, никаких
        действий не потребуется.
      </p>
    </div>
  `;

  await sendMail({
    to: email,
    subject: "Регистрация на сервисе «Ключевое слово» подтверждена",
    html,
  });
}
