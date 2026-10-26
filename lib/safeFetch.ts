// Безопасная загрузка чужих публичных страниц и RSS-лент для мониторинга.
// Адрес приходит от пользователя (сайт конкурента) или администратора (лента), поэтому:
//  • только http/https, без логина в адресе, только порты 80 и 443;
//  • адрес не должен вести во внутреннюю сеть (localhost, частные диапазоны, метаданные облака):
//    проверяется IP, к которому реально идёт соединение (защита и от подмены DNS), и каждый редирект;
//  • ограничены время и размер ответа, число редиректов; сжатие не запрашивается.
// Файл только для сервера (node:http / node:dns).

import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

export const MONITOR_USER_AGENT = "KeyWordMonitor/1.0 (+https://m-navi.ru)";

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  userAgent?: string;
  accept?: string;
  /** Только для тестов: разрешить loopback и произвольные порты. В API не пробрасывается. */
  allowPrivate?: boolean;
}

export interface FetchResult {
  status: number;
  finalUrl: string;
  contentType: string;
  body: string;
  truncated: boolean;
}

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

// ───────────────────────── проверка адресов ─────────────────────────

function ipv4ToInt(ip: string): number | null {
  const p = ip.split(".");
  if (p.length !== 4) return null;
  let n = 0;
  for (const part of p) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const v = Number(part);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n;
}

const V4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/** Адрес из частных, служебных и зарезервированных диапазонов (или не IP вовсе). */
export function isPrivateAddress(ip: string): boolean {
  let addr = ip.trim().toLowerCase();
  if (addr.startsWith("[") && addr.endsWith("]")) addr = addr.slice(1, -1);
  const zone = addr.indexOf("%");
  if (zone >= 0) addr = addr.slice(0, zone);

  if (net.isIPv4(addr)) {
    const n = ipv4ToInt(addr);
    if (n === null) return true;
    return V4_BLOCKS.some(([base, bits]) => {
      const b = ipv4ToInt(base) as number;
      const size = 2 ** (32 - bits);
      return n >= b && n < b + size;
    });
  }
  if (net.isIPv6(addr)) {
    if (addr === "::" || addr === "::1") return true;
    const mapped = addr.match(/^(?:0{0,4}:){0,5}(?:ffff:)(\d+\.\d+\.\d+\.\d+)$/) || addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    // IPv4, записанный в hex-форме (::ffff:7f00:1)
    const hexMapped = addr.match(/^(?:0{0,4}:){0,5}ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    const first = parseInt(addr.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10
    if ((first & 0xff00) === 0xff00) return true; // ff00::/8
    if (addr.startsWith("64:ff9b:")) return true; // NAT64
    if (addr.startsWith("2001:db8:") || addr.startsWith("2001:0db8:")) return true; // документация
    return false;
  }
  return true;
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** Можно ли вообще пытаться открыть адрес (без обращения к DNS). */
export function parsePublicUrl(raw: unknown, opts: { allowPrivate?: boolean } = {}): UrlCheck {
  if (typeof raw !== "string") return { ok: false, reason: "Укажите адрес сайта" };
  const text = raw.trim();
  if (!text || text.length > 500) return { ok: false, reason: "Адрес слишком длинный или пустой" };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return { ok: false, reason: "Не удалось разобрать адрес" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "Нужен адрес, начинающийся с http:// или https://" };
  if (url.username || url.password) return { ok: false, reason: "Адрес не должен содержать логин и пароль" };
  if (!opts.allowPrivate) {
    if (url.port && url.port !== "80" && url.port !== "443") return { ok: false, reason: "Допустимы только стандартные порты" };
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) {
      return { ok: false, reason: "Этот адрес недоступен для проверки" };
    }
    if (net.isIP(host) && isPrivateAddress(host)) return { ok: false, reason: "Этот адрес недоступен для проверки" };
    if (!net.isIP(host) && !host.includes(".")) return { ok: false, reason: "Укажите полный адрес сайта" };
  }
  url.hash = "";
  return { ok: true, url };
}

// ───────────────────────── загрузка ─────────────────────────

type LookupCb = (err: NodeJS.ErrnoException | null, address?: any, family?: number) => void;

function guardedLookup(allowPrivate: boolean) {
  return (hostname: string, options: any, cb: LookupCb) => {
    const callback: LookupCb = typeof options === "function" ? options : cb;
    const opts = typeof options === "function" ? {} : options || {};
    dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
      if (err) return callback(err);
      const list = (addresses as unknown as { address: string; family: number }[]) || [];
      if (list.length === 0) return callback(new Error("Адрес не найден") as NodeJS.ErrnoException);
      if (!allowPrivate && list.some((a) => isPrivateAddress(a.address))) {
        return callback(new BlockedUrlError("Этот адрес недоступен для проверки") as NodeJS.ErrnoException);
      }
      if (opts.all) return callback(null, list);
      return callback(null, list[0].address, list[0].family);
    });
  };
}

function decodeBody(buf: Buffer, contentType: string): string {
  let charset = (contentType.match(/charset=["']?([\w-]+)/i)?.[1] || "").toLowerCase();
  if (!charset) {
    const head = buf.subarray(0, 4096).toString("latin1");
    charset = (head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] || head.match(/<\?xml[^>]+encoding=["']([\w-]+)/i)?.[1] || "").toLowerCase();
  }
  try {
    return new TextDecoder(charset || "utf-8").decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}

function requestOnce(url: URL, o: Required<Pick<FetchOptions, "timeoutMs" | "maxBytes" | "userAgent" | "accept">> & { allowPrivate: boolean }): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    let done = false;
    const finish = (fn: () => void) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn();
    };
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup(o.allowPrivate) as any,
        headers: { "User-Agent": o.userAgent, Accept: o.accept, "Accept-Encoding": "identity", "Accept-Language": "ru,en;q=0.8" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > o.maxBytes) {
            truncated = true;
            chunks.push(c.subarray(0, c.length - (size - o.maxBytes)));
            res.destroy();
            return;
          }
          chunks.push(c);
        });
        const end = () => finish(() => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks), truncated }));
        res.on("end", end);
        res.on("close", end);
        res.on("error", (e) => finish(() => (truncated ? resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks), truncated }) : reject(e))));
      }
    );
    const timer = setTimeout(() => {
      finish(() => reject(new Error("Сайт не ответил вовремя")));
      req.destroy();
    }, o.timeoutMs);
    req.on("error", (e) => finish(() => reject(e)));
    req.end();
  });
}

/** Загружает страницу с защитой от обращения во внутреннюю сеть. Бросает BlockedUrlError или Error с понятным текстом. */
export async function safeGet(rawUrl: string, options: FetchOptions = {}): Promise<FetchResult> {
  const o = {
    timeoutMs: options.timeoutMs ?? 10000,
    maxBytes: options.maxBytes ?? 1_500_000,
    userAgent: options.userAgent ?? MONITOR_USER_AGENT,
    accept: options.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
    allowPrivate: options.allowPrivate === true,
  };
  const maxRedirects = options.maxRedirects ?? 3;
  let current = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = parsePublicUrl(current, { allowPrivate: o.allowPrivate });
    if (!check.ok) throw new BlockedUrlError(check.reason);
    let res;
    try {
      res = await requestOnce(check.url, o);
    } catch (e) {
      if (e instanceof BlockedUrlError) throw e;
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === "ENOTFOUND" || code === "EAI_AGAIN") throw new Error("Сайт не найден: проверьте адрес");
      if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "EHOSTUNREACH") throw new Error("Сайт не отвечает");
      if (code === "CERT_HAS_EXPIRED" || code === "DEPTH_ZERO_SELF_SIGNED_CERT" || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") throw new Error("У сайта проблема с сертификатом");
      throw e instanceof Error ? e : new Error("Не удалось загрузить страницу");
    }
    if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.location) {
      try {
        current = new URL(String(res.headers.location), check.url).toString();
      } catch {
        throw new Error("Сайт вернул некорректное перенаправление");
      }
      continue;
    }
    const contentType = String(res.headers["content-type"] || "");
    return { status: res.status, finalUrl: check.url.toString(), contentType, body: decodeBody(res.body, contentType), truncated: res.truncated };
  }
  throw new Error("Слишком много перенаправлений");
}
