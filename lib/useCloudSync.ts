"use client";

import { useSyncExternalStore } from "react";
import { getServerSyncState, getSyncState, subscribeSync } from "./cloudSync";

/** ready — первая загрузка с сервера закончилась (удачно или нет); tick меняется после каждой синхронизации. */
export function useCloudSync() {
  const s = useSyncExternalStore(subscribeSync, getSyncState, getServerSyncState);
  return { ready: s.status === "ready" || s.status === "error", tick: s.tick, status: s.status };
}
