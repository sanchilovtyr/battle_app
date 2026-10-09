import { getIndexNowKey } from "@/lib/indexnowCore";

export const dynamic = "force-dynamic";

/**
 * Файл-подтверждение владельца для IndexNow. Поисковик открывает /<ключ>.txt в корне сайта
 * (next.config.js переписывает этот адрес сюда) и сверяет содержимое с ключом из запроса.
 */
export async function GET(_req: Request, { params }: { params: { key: string } }) {
  const key = getIndexNowKey();
  if (!key || params.key !== key) return new Response("Not found", { status: 404 });
  return new Response(key, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
