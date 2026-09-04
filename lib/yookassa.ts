import { randomUUID } from "crypto";

const API_BASE = "https://api.yookassa.ru/v3";

function authHeader(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) {
    throw new Error(
      "YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY не заданы в переменных окружения"
    );
  }
  return "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64");
}

export interface CreatePaymentParams {
  amountRub: number;
  description: string;
  returnUrl: string;
  metadata: Record<string, string>;
  /** Сохранить способ оплаты для будущих автосписаний за продление */
  savePaymentMethod?: boolean;
  /** Списание сохранённым способом (автопродление) — без редиректа пользователя */
  paymentMethodId?: string;
}

export async function createYookassaPayment(params: CreatePaymentParams) {
  const body: Record<string, unknown> = {
    amount: { value: params.amountRub.toFixed(2), currency: "RUB" },
    description: params.description,
    metadata: params.metadata,
    capture: true,
  };

  if (params.paymentMethodId) {
    body.payment_method_id = params.paymentMethodId;
  } else {
    body.confirmation = { type: "redirect", return_url: params.returnUrl };
    if (params.savePaymentMethod) body.save_payment_method = true;
  }

  const res = await fetch(`${API_BASE}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotence-Key": randomUUID(),
      Authorization: authHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`ЮKassa API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/**
 * Всегда сверяем статус платежа напрямую через API, а не доверяем телу запроса
 * на вебхук — так вебхук нельзя подделать, отправив на его адрес произвольные данные.
 */
export async function getYookassaPayment(paymentId: string) {
  const res = await fetch(`${API_BASE}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) {
    throw new Error(`ЮKassa API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
