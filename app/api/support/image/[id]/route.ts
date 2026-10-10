import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/session";
import { verifyAdminToken, ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { prisma } from "@/lib/db";
import { sniffImageMime } from "@/lib/blog";

export const dynamic = "force-dynamic";

/** Вложение тикета: видно автору тикета и админу. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const msg = await prisma.supportMessage.findUnique({
    where: { id: params.id },
    select: { userId: true, image: true },
  });
  if (!msg?.image) return new NextResponse("Not found", { status: 404 });

  const isAdmin = verifyAdminToken(cookies().get(ADMIN_COOKIE_NAME)?.value);
  if (!isAdmin) {
    const user = await getCurrentUser();
    if (!user || user.id !== msg.userId) return new NextResponse("Not found", { status: 404 });
  }
  const buf = Buffer.from(msg.image as Uint8Array);
  return new NextResponse(buf, {
    headers: { "Content-Type": sniffImageMime(buf), "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
