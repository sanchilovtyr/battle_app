/**
 * Браузерная часть собственной аналитики: клики и глубина прокрутки (для карт) и запись сессии (вебвизор).
 * Работает только на публичных страницах (isBehaviorPath). Поля ввода в записи всегда скрыты.
 */
import { CLICK_GRID, deviceFromWidth, isBehaviorPath } from "@/lib/analyticsCore";

// ───────────── карты: клики и скролл ─────────────

interface PendingClick { s: string; x: number; y: number }

let curPath: string | null = null;
let clicks: PendingClick[] = [];
let maxDepth = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;
/** Глубина текущего просмотра уже отправлена (скрытие вкладки и закрытие приходят подряд — считаем один раз) */
let scrollSent = false;

const INTERACTIVE = "a,button,input,select,textarea,label,summary,[role=button],[role=link]";

function cssPath(el: Element): string | null {
  const parts: string[] = [];
  let cur: Element | null = el;
  let depth = 0;
  while (cur && cur !== document.documentElement && depth < 20) {
    if (cur.id && /^[A-Za-z][\w-]*$/.test(cur.id) && document.querySelectorAll("#" + cur.id).length === 1) {
      parts.unshift("#" + cur.id);
      break;
    }
    const parent: Element | null = cur.parentElement;
    let idx = 1;
    if (parent) {
      for (const sib of Array.from(parent.children)) {
        if (sib === cur) break;
        if (sib.tagName === cur.tagName) idx++;
      }
    }
    parts.unshift(`${cur.tagName.toLowerCase()}:nth-of-type(${idx})`);
    cur = parent;
    depth++;
  }
  const s = parts.join(" > ");
  return s.length > 0 && s.length <= 300 ? s : null;
}

function onClick(e: MouseEvent) {
  try {
    if (!curPath || !isBehaviorPath(curPath)) return;
    const t = e.target as Element | null;
    if (!t || !(t instanceof Element) || t === document.documentElement) return;
    if (t.closest("[data-mn-block]")) return;
    const el = t.closest(INTERACTIVE) || t;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const sel = cssPath(el);
    if (!sel) return;
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * CLICK_GRID);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * CLICK_GRID);
    clicks.push({ s: sel, x: Math.min(CLICK_GRID - 1, Math.max(0, x)), y: Math.min(CLICK_GRID - 1, Math.max(0, y)) });
    if (clicks.length >= 25) flushBehavior(false);
    else if (!timer) timer = setTimeout(() => flushBehavior(false), 5000);
  } catch {
    /* карты не должны ломать страницу */
  }
}

function measureDepth() {
  const h = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
  if (!h) return;
  const d = ((window.scrollY + window.innerHeight) / h) * 100;
  if (d > maxDepth) maxDepth = Math.min(100, d);
}

/** Отправляет накопленное. withScroll — страница закрывается или меняется: фиксируем глубину просмотра */
function flushBehavior(withScroll: boolean) {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!curPath || !isBehaviorPath(curPath)) {
    clicks = [];
    return;
  }
  if (withScroll && scrollSent) withScroll = false;
  if (withScroll) {
    measureDepth();
    scrollSent = true;
  }
  const payload = {
    path: curPath,
    device: deviceFromWidth(window.innerWidth),
    clicks,
    scroll: withScroll ? Math.min(10, Math.floor(maxDepth / 10)) : null,
  };
  clicks = [];
  if (!payload.clicks.length && payload.scroll === null) return;
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track/behavior", new Blob([body], { type: "application/json" }));
    else fetch("/api/track/behavior", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    /* ничего */
  }
}

export function behaviorPageChange(path: string) {
  if (curPath && curPath !== path) flushBehavior(true);
  if (curPath !== path) {
    curPath = path;
    maxDepth = 0;
    scrollSent = false;
    setTimeout(measureDepth, 600);
  }
  if (!listening) {
    listening = true;
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", measureDepth, { passive: true });
    window.addEventListener("pagehide", () => {
      flushBehavior(true);
      flushEvents(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushBehavior(true);
        flushEvents(true);
      } else {
        maxDepth = 0;
        scrollSent = false;
        measureDepth();
      }
    });
  }
}

// ───────────── вебвизор ─────────────

const MAX_RECORD_MS = 8 * 60 * 1000;
const MAX_SENT_CHARS = 3_000_000;
const FLUSH_CHARS = 40_000;

let stopFn: (() => void) | null = null;
let starting = false;
let buf: unknown[] = [];
let bufChars = 0;
let sentChars = 0;
let startedAt = 0;
let ids: { vid: string; sid: string } | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;

export function flushEvents(closing = false) {
  if (!ids || !buf.length) return;
  const body = JSON.stringify({ vid: ids.vid, sid: ids.sid, events: buf });
  buf = [];
  bufChars = 0;
  sentChars += body.length;
  try {
    fetch("/api/track/events", { method: "POST", body, keepalive: body.length < 60_000 || closing }).catch(() => {});
  } catch {
    /* ничего */
  }
  if (sentChars > MAX_SENT_CHARS || Date.now() - startedAt > MAX_RECORD_MS) stopRecording();
}

export function stopRecording() {
  if (stopFn) {
    try {
      stopFn();
    } catch {
      /* ничего */
    }
    stopFn = null;
  }
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

export async function startRecording(vid: string, sid: string) {
  if (stopFn || starting) {
    if (ids && ids.sid !== sid) ids = { vid, sid };
    return;
  }
  if (sentChars > MAX_SENT_CHARS) return;
  starting = true;
  try {
    ids = { vid, sid };
    if (!startedAt) startedAt = Date.now();
    if (Date.now() - startedAt > MAX_RECORD_MS) return;
    const { record } = await import("@rrweb/record");
    stopFn =
      record({
        emit(event: unknown) {
          buf.push(event);
          bufChars += JSON.stringify(event).length;
          if (bufChars > FLUSH_CHARS) flushEvents();
        },
        // Всё, что человек вводит, скрыто всегда; разделы с пометкой data-mn-block в запись не попадают
        maskAllInputs: true,
        blockSelector: "[data-mn-block]",
        slimDOMOptions: "all",
        inlineStylesheet: true,
        recordCanvas: false,
        collectFonts: false,
        sampling: { mousemove: 120, scroll: 150, input: "last" },
      }) || null;
    flushTimer = setInterval(() => flushEvents(), 8000);
  } catch {
    stopFn = null;
  } finally {
    starting = false;
  }
}
