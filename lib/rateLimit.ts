// Простой лимитер в памяти процесса. Подходит для одного постоянно работающего
// контейнера (как на Timeweb App Platform) — но не переживёт перезапуск и не
// работает, если инстансов приложения станет несколько одновременно. Для
// серьёзного масштабирования это стоит заменить на Redis или похожее внешнее
// хранилище, общее для всех инстансов.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Периодически подчищаем память от устаревших записей, чтобы Map не росла бесконечно
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

/**
 * Возвращает true, если лимит ещё не исчерпан (запрос разрешён).
 * key — обычно IP-адрес + название операции, чтобы не мешать лимиты разных ручек
 */
export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxAttempts) return false;

  bucket.count += 1;
  return true;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
