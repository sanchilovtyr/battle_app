import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";

export async function GET() {
  const token = cookies().get(ADMIN_COOKIE_NAME)?.value;
  return NextResponse.json({ authenticated: verifyAdminToken(token) });
}
