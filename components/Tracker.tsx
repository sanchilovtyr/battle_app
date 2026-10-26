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

/** Собственный счётчик посещений: хранит анонимный номер посетителя в cookie и сообщает о просмотре страницы. Работает только на публичных страницах. */
export default function Tracker() {
  const pathname = usePathname();

  useEffect(() => {
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
    } catch {
      /* счётчик не должен ломать страницу */
    }
  }, [pathname]);

  return null;
}
