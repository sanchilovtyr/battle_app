"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isBehaviorPath } from "@/lib/analyticsCore";
import { behaviorPageChange, flushEvents, startRecording, stopRecording } from "@/lib/trackerClient";

const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "yclid", "gclid"];
const SESSION_MS = 30 * 60 * 1000;

function rnd(): string {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  } catch {
    /* старый браузер */
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
}

interface Sess { id: string; t: number; k: string; rec?: boolean }

function readSess(): Sess | null {
  try {
    return JSON.parse(localStorage.getItem("mn_sess") || "null");
  } catch {
    return null;
  }
}
function writeSess(v: Sess) {
  try {
    localStorage.setItem("mn_sess", JSON.stringify(v));
  } catch {
    /* хранилище недоступно */
  }
}

/**
 * Считает активное время на странице (вкладка открыта и видна) и сообщает его серверу порциями:
 * каждые 15 секунд активного времени и при уходе со страницы. По этому времени считаются отказы.
 */
function startEngagement(vid: string, sid: string): () => void {
  let active = 0;
  let last = document.visibilityState === "visible" ? Date.now() : 0;
  let sent = 0;
  const tick = () => {
    if (last) {
      const n = Date.now();
      active += n - last;
      last = n;
    }
  };
  const send = () => {
    tick();
    const sec = Math.min(1800, Math.floor(active / 1000));
    const delta = sec - sent;
    if (delta <= 0) return;
    sent = sec;
    const body = JSON.stringify({ vid, sid, sec: delta });
    try {
      // sendBeacon надёжнее всего доходит при закрытии вкладки и переходе на другой сайт
      if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/track/engage", new Blob([body], { type: "application/json" }))) return;
    } catch {
      /* пробуем обычный запрос */
    }
    try {
      fetch("/api/track/engage", { method: "POST", keepalive: true, headers: { "content-type": "application/json" }, body }).catch(() => {});
    } catch {
      /* не критично */
    }
  };
  const onVis = () => {
    if (document.visibilityState === "hidden") {
      send();
      last = 0;
    } else if (!last) last = Date.now();
  };
  const timer = window.setInterval(() => {
    tick();
    // порция уходит при достижении 15 секунд (порог отказа) и затем каждые 15 секунд: даже если закрытие вкладки не дойдёт, время не потеряется
    if (active - sent * 1000 >= 15000) send();
  }, 2000);
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("pagehide", send);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("pagehide", send);
    send();
  };
}

/** Собственный счётчик посещений: хранит анонимный номер посетителя в cookie и сообщает о просмотре страницы. Работает только на публичных страницах. */
export default function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    try {
      // Страницы, показанные в рамке админки (карты кликов), в статистику не попадают
      if (window.top !== window.self) return;
      if (!pathname || /^\/(admin|api)(\/|$)/.test(pathname)) return;
      if (navigator.doNotTrack === "1") return;

      let vid = readCookie("mn_vid");
      if (!vid) {
        vid = rnd();
        document.cookie = `mn_vid=${vid}; max-age=${400 * 86400}; path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
        if (!readCookie("mn_vid")) return; // cookie запрещены — не считаем
      }

      const search = new URLSearchParams(location.search);
      const params: Record<string, string> = {};
      for (const k of PARAMS) {
        const v = search.get(k);
        if (v) params[k] = v;
      }
      const stamp = Object.keys(params).sort().map((k) => k + "=" + params[k]).join("&");

      const now = Date.now();
      const sess = readSess();
      // Новая сессия: нет прежней, прошло больше 30 минут, или человек пришёл по ссылке с другими метками
      const expired = !sess || now - sess.t > SESSION_MS;
      const newTags = !!stamp && (!sess || sess.k !== stamp);
      const isNew = expired || newTags;
      const next: Sess = isNew ? { id: rnd(), t: now, k: stamp || (sess && !expired ? sess.k : "") } : { ...sess!, t: now };
      writeSess(next);
      const sid = next.id;

      // Карты кликов и скролла (на публичных страницах)
      if (isBehaviorPath(pathname)) behaviorPageChange(pathname);
      else {
        behaviorPageChange(pathname);
        flushEvents(true);
        stopRecording();
      }

      // Запись сессии: продолжаем, если сервер её разрешил, и только на публичных страницах
      if (!isNew && next.rec && isBehaviorPath(pathname)) void startRecording(vid, sid);

      const payload = JSON.stringify({
        vid,
        sid,
        path: pathname,
        isNew,
        w: window.innerWidth,
        referrer: isNew ? document.referrer : "",
        params: isNew ? params : {},
      });
      fetch("/api/track", { method: "POST", body: payload, keepalive: true, headers: { "content-type": "application/json" } })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j) return;
          const cur = readSess();
          if (cur && cur.id === sid) writeSess({ ...cur, rec: !!j.rec });
          if (j.rec && isBehaviorPath(pathname)) void startRecording(vid!, sid);
          else if (!j.rec) stopRecording();
        })
        .catch(() => {});

      cleanup = startEngagement(vid, sid);
    } catch {
      /* счётчик не должен ломать страницу */
    }
    return () => cleanup?.();
  }, [pathname]);

  return null;
}
