import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";

export function isAdminRequest(): boolean {
  return verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value);
}
