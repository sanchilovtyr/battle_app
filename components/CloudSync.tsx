"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { flushQueue, maybeResync, resetSyncState, syncFromServer } from "@/lib/cloudSync";

/** Подтягивает данные бизнесов с сервера при входе и держит их синхронными. Ничего не рисует. */
export default function CloudSync() {
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  useEffect(() => {
    if (status === "unauthenticated") resetSyncState();
    if (status !== "authenticated" || !userId) return;
    void syncFromServer(userId);

    const onVisible = () => {
      if (document.visibilityState === "visible") maybeResync(userId);
    };
    const onOnline = () => void flushQueue();
    const onHide = () => void flushQueue();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pagehide", onHide);
    };
  }, [status, userId]);

  return null;
}
