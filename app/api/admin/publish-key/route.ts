import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { createPublishKey, publishKeyStatus, revokePublishKey } from "@/lib/publishKey";

export const dynamic = "force-dynamic";
const requireAdmin = () => verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value);
const deny = () => NextResponse.json({ error: "Не авторизован" }, { status: 401 });

export async function GET() {
  if (!requireAdmin()) return deny();
  return NextResponse.json(await publishKeyStatus());
}

/** Выпуск нового ключа: старый сразу перестаёт работать, новый возвращается один раз. */
export async function POST() {
  if (!requireAdmin()) return deny();
  const key = await createPublishKey();
  return NextResponse.json({ key, ...(await publishKeyStatus()) });
}

export async function DELETE() {
  if (!requireAdmin()) return deny();
  await revokePublishKey();
  return NextResponse.json({ ok: true });
}
