import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { getKey, keyStatuses, setKey, type KeyName } from "@/lib/integrationKeys";
import {
  fetchGoogleReport,
  fetchYandexReport,
  parseGoogleKeyJson,
  normalizePem,
  SearchEngineError,
} from "@/lib/searchEngines";
import { SITE_URL } from "@/lib/blog";

export const dynamic = "force-dynamic";

function isAdmin(): boolean {
  return verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value);
}

/** Какие ключи заданы (значения секретов не возвращаются). */
export async function GET() {
  if (!isAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  return NextResponse.json({ keys: await keyStatuses(), siteUrl: SITE_URL });
}

/** Сохранить или стереть ключи. */
export async function PUT(req: Request) {
  if (!isAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  if (b?.clear === "yandex") {
    await setKey("YANDEX_WEBMASTER_TOKEN", null);
    await setKey("YANDEX_WEBMASTER_HOST", null);
    return NextResponse.json({ ok: true, keys: await keyStatuses() });
  }
  if (b?.clear === "google") {
    for (const n of ["GOOGLE_SC_CLIENT_EMAIL", "GOOGLE_SC_PRIVATE_KEY", "GOOGLE_SC_SITE_URL"] as KeyName[]) await setKey(n, null);
    return NextResponse.json({ ok: true, keys: await keyStatuses() });
  }

  const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const yt = str(b?.yandexToken, 500);
  if (yt) await setKey("YANDEX_WEBMASTER_TOKEN", yt);
  if (b?.yandexHost !== undefined) await setKey("YANDEX_WEBMASTER_HOST", str(b.yandexHost, 200));

  const gj = str(b?.googleJson, 10000);
  if (gj) {
    const parsed = parseGoogleKeyJson(gj);
    if (!parsed) {
      return NextResponse.json({ error: "Это не похоже на JSON-ключ сервисного аккаунта Google (нужны поля client_email и private_key)" }, { status: 400 });
    }
    await setKey("GOOGLE_SC_CLIENT_EMAIL", parsed.clientEmail);
    await setKey("GOOGLE_SC_PRIVATE_KEY", parsed.privateKey);
  } else {
    const ge = str(b?.googleEmail, 200);
    const gk = str(b?.googlePrivateKey, 5000);
    if (ge) await setKey("GOOGLE_SC_CLIENT_EMAIL", ge);
    if (gk) {
      if (!gk.includes("PRIVATE KEY")) {
        return NextResponse.json({ error: "Приватный ключ должен начинаться с -----BEGIN PRIVATE KEY-----" }, { status: 400 });
      }
      await setKey("GOOGLE_SC_PRIVATE_KEY", normalizePem(gk));
    }
  }
  if (b?.googleSite !== undefined) await setKey("GOOGLE_SC_SITE_URL", str(b.googleSite, 200));
  return NextResponse.json({ ok: true, keys: await keyStatuses() });
}

/** Проверить подключение и получить данные. Тело: { engine: "yandex" | "google" } */
export async function POST(req: Request) {
  if (!isAdmin()) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const b = await req.json().catch(() => ({}));

  try {
    if (b?.engine === "yandex") {
      const token = (await getKey("YANDEX_WEBMASTER_TOKEN")).value;
      if (!token) return NextResponse.json({ error: "Токен Яндекс Вебмастера не задан" }, { status: 400 });
      const host = (await getKey("YANDEX_WEBMASTER_HOST")).value;
      return NextResponse.json({ ok: true, report: await fetchYandexReport(token, SITE_URL, host || undefined) });
    }
    if (b?.engine === "google") {
      const email = (await getKey("GOOGLE_SC_CLIENT_EMAIL")).value;
      const pk = (await getKey("GOOGLE_SC_PRIVATE_KEY")).value;
      if (!email || !pk) return NextResponse.json({ error: "Ключ сервисного аккаунта Google не задан" }, { status: 400 });
      const site = (await getKey("GOOGLE_SC_SITE_URL")).value || `${SITE_URL}/`;
      return NextResponse.json({ ok: true, report: await fetchGoogleReport({ clientEmail: email, privateKey: normalizePem(pk) }, site) });
    }
  } catch (e) {
    const msg = e instanceof SearchEngineError ? e.message : "Не удалось получить данные. Проверьте ключи и повторите.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json({ error: "Укажите engine: yandex или google" }, { status: 400 });
}
