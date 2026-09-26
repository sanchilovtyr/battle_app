import nodemailer from "nodemailer";
import { EXECUTOR } from "./offer";

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
    connectionTimeout: 10000, // 10 секунд на установку соединения, дальше — явная ошибка
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  return cachedTransporter;
}

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}) {
  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo,
    attachments: params.attachments,
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

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111525;">
      <h2 style="margin-bottom: 8px;">Восстановление пароля</h2>
      <p>Здравствуйте!</p>
      <p>
        Мы получили запрос на восстановление пароля для аккаунта <b>${email}</b>
        на сервисе «Ключевое слово».
      </p>
      <p>
        <a href="${resetUrl}" style="color: #7658F6;">Придумать новый пароль →</a>
      </p>
      <p style="color: #70758A; font-size: 13px; margin-top: 24px;">
        Ссылка действительна 1 час. Если это были не вы — просто проигнорируйте
        письмо, пароль останется прежним.
      </p>
    </div>
  `;

  await sendMail({
    to: email,
    subject: "Восстановление пароля — «Ключевое слово»",
    html,
  });
}

export async function sendPasswordChangedEmail(email: string) {
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111525;">
      <h2 style="margin-bottom: 8px;">Пароль изменён</h2>
      <p>Здравствуйте!</p>
      <p>
        Пароль для аккаунта <b>${email}</b> на сервисе «Ключевое слово» только
        что был изменён.
      </p>
      <p style="color: #70758A; font-size: 13px; margin-top: 24px;">
        Если это были не вы — напишите нам на ${EXECUTOR.email}, чтобы мы могли
        разобраться.
      </p>
    </div>
  `;

  await sendMail({
    to: email,
    subject: "Пароль изменён — «Ключевое слово»",
    html,
  });
}

export async function sendPlanPdfEmail(email: string, businessName: string, pdfBytes: Uint8Array) {
  const siteUrl = process.env.NEXTAUTH_URL || "";

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111525;">
      <h2 style="margin-bottom: 8px;">Ваш план продвижения</h2>
      <p>Здравствуйте!</p>
      <p>
        Во вложении — план продвижения для «<b>${businessName}</b>» в PDF.
      </p>
      <p>
        <a href="${siteUrl}/account" style="color: #7658F6;">Открыть в личном кабинете →</a>
      </p>
    </div>
  `;

  await sendMail({
    to: email,
    subject: `План продвижения — ${businessName}`,
    html,
    attachments: [
      {
        filename: "plan.pdf",
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });
}

/** Уведомление владельцу сервиса о новой регистрации — не отправляется,
 *  если ADMIN_NOTIFY_EMAIL не задан в переменных окружения */
export async function sendAdminNewUserNotification(userEmail: string) {
  const notifyTo = process.env.ADMIN_NOTIFY_EMAIL;
  if (!notifyTo) return;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111525;">
      <h2 style="margin-bottom: 8px;">Новая регистрация</h2>
      <p>На сервисе «Ключевое слово» зарегистрировался новый пользователь:</p>
      <p><b>${userEmail}</b></p>
    </div>
  `;

  await sendMail({
    to: notifyTo,
    subject: `Новый пользователь: ${userEmail}`,
    html,
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Заявка с формы обратной связи на лендинге — уходит на общую почту проекта */
export async function sendContactFormEmail(params: { name: string; contact: string; message: string }) {
  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #111525;">
      <h2 style="margin-bottom: 8px;">Новое сообщение с формы обратной связи</h2>
      <p><b>Имя:</b> ${escapeHtml(params.name)}</p>
      <p><b>Контакт для ответа:</b> ${escapeHtml(params.contact)}</p>
      <p><b>Сообщение:</b></p>
      <p style="white-space: pre-wrap;">${escapeHtml(params.message)}</p>
    </div>
  `;

  await sendMail({
    to: EXECUTOR.email,
    subject: `Заявка с сайта от ${params.name}`,
    html,
    replyTo: EMAIL_RE.test(params.contact.trim()) ? params.contact.trim() : undefined,
  });
}
