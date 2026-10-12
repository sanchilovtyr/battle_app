// Синхронизация данных бизнеса с сервером, чтобы они открывались с любого
// браузера. Схема простая:
//  • сервер — источник правды (таблица Business, /api/businesses);
//  • localStorage — кэш, с которым работают все существующие компоненты;
//  • любое изменение сначала пишется в localStorage, а затем отправляется на
//    сервер (очередь "что изменено" хранится рядом и переживает закрытие вкладки);
//  • при входе и при возвращении на вкладку данные подтягиваются с сервера;
//  • данные, которые до этого обновления жили только в браузере, при первом
//    входе загружаются в аккаунт (перенос).
// Модуль не импортирует account/checklist/funnel/…, чтобы не было циклов:
// ключи localStorage продублированы здесь.

const BUSINESSES_KEY = "promoplan_businesses";
const OWNER_KEY = "promoplan_sync_owner";
const QUEUE_KEY = "promoplan_sync_queue";
const SYNC_EVENT = "promoplan:synced";

export type SyncField = "vectorId" | "checklist" | "funnel" | "progress" | "target" | "name";

interface QueueEntry {
  put?: boolean; // нужно создать/залить бизнес целиком
  del?: boolean;
  fields?: SyncField[];
}
type Queue = Record<string, QueueEntry>;

const fieldKey = {
  checklist: (id: string) => `promoplan_checklist_${id}`,
  funnel: (id: string) => `promoplan_funnel_${id}`,
  progress: (id: string) => `promoplan_progress_${id}`,
  target: (id: string) => `promoplan_target_${id}`,
};

function get(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function set(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // нет доступа к хранилищу — работаем без кэша
  }
}
function remove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // не критично
  }
}
function readJson<T>(key: string, fallback: T): T {
  const raw = get(key);
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return v === null || v === undefined ? fallback : (v as T);
  } catch {
    return fallback;
  }
}

// ───────────── очередь отправки ─────────────

function readQueue(): Queue {
  const q = readJson<Queue>(QUEUE_KEY, {});
  return q && typeof q === "object" && !Array.isArray(q) ? q : {};
}
function writeQueue(q: Queue) {
  if (Object.keys(q).length === 0) remove(QUEUE_KEY);
  else set(QUEUE_KEY, JSON.stringify(q));
}

/** Пометить, что у бизнеса изменились поля, и запланировать отправку. */
export function markDirty(businessId: string, fields: SyncField[]) {
  const q = readQueue();
  const cur = q[businessId] ?? {};
  if (cur.del) return;
  const merged = Array.from(new Set([...(cur.fields ?? []), ...fields]));
  q[businessId] = { ...cur, fields: merged };
  writeQueue(q);
  schedulePush();
}

/** Бизнес создан локально — загрузить на сервер целиком. */
export function markCreated(businessId: string) {
  const q = readQueue();
  q[businessId] = { put: true };
  writeQueue(q);
  schedulePush();
}

export function markDeleted(businessId: string) {
  const q = readQueue();
  q[businessId] = { del: true };
  writeQueue(q);
  schedulePush();
}

function readLocalBusiness(id: string) {
  const list = readJson<any[]>(BUSINESSES_KEY, []);
  return Array.isArray(list) ? list.find((b) => b?.id === id) ?? null : null;
}

function localField(id: string, f: SyncField): unknown {
  const b = readLocalBusiness(id);
  switch (f) {
    case "vectorId":
      return b?.vectorId ?? null;
    case "name":
      return b?.name ?? "";
    case "checklist":
      return readJson(fieldKey.checklist(id), {});
    case "funnel":
      return readJson(fieldKey.funnel(id), []);
    case "progress":
      return readJson(fieldKey.progress(id), []);
    case "target":
      return readJson(fieldKey.target(id), {});
  }
}

function fullPayload(id: string) {
  const b = readLocalBusiness(id);
  if (!b) return null;
  return {
    name: b.name,
    businessType: b.businessType,
    createdAt: b.createdAt,
    plan: b.plan,
    vectorId: b.vectorId ?? null,
    checklist: localField(id, "checklist"),
    funnel: localField(id, "funnel"),
    progress: localField(id, "progress"),
    target: localField(id, "target"),
  };
}

let flushing: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function schedulePush() {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flushQueue();
  }, 700);
}

type Outcome = "ok" | "drop" | "retry";
const outcome = (status: number): Outcome =>
  status >= 200 && status < 300 ? "ok" : status === 401 || status === 429 || status >= 500 ? "retry" : "drop";

async function send(method: string, id: string, body?: unknown): Promise<Outcome> {
  try {
    const res = await fetch(`/api/businesses/${encodeURIComponent(id)}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      keepalive: !body || JSON.stringify(body).length < 50_000,
    });
    // PATCH по несуществующему на сервере бизнесу — зальём целиком
    if (method === "PATCH" && res.status === 404) return "drop";
    return outcome(res.status);
  } catch {
    return "retry";
  }
}

/** Отправить накопленные изменения. Не отправленное остаётся в очереди до следующей попытки. */
export function flushQueue(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (flushing) return flushing;
  flushing = (async () => {
    const q = readQueue();
    for (const [id, entry] of Object.entries(q)) {
      let result: Outcome = "ok";
      if (entry.del) {
        result = await send("DELETE", id);
      } else if (entry.put) {
        const payload = fullPayload(id);
        result = payload ? await send("PUT", id, payload) : "drop";
      } else if (entry.fields?.length) {
        const payload: Record<string, unknown> = {};
        for (const f of entry.fields) payload[f] = localField(id, f);
        result = await send("PATCH", id, payload);
        if (result === "drop") {
          // сервер не знает такого бизнеса — загрузим целиком
          const full = fullPayload(id);
          result = full ? await send("PUT", id, full) : "drop";
        }
      }
      if (result !== "retry") {
        const fresh = readQueue();
        // если за время отправки пришли новые изменения — оставляем их
        if (JSON.stringify(fresh[id]) === JSON.stringify(entry)) delete fresh[id];
        writeQueue(fresh);
      }
    }
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

// ───────────── загрузка с сервера ─────────────

export type SyncStatus = "idle" | "syncing" | "ready" | "error";
let state: { status: SyncStatus; tick: number } = { status: "idle", tick: 0 };
const listeners = new Set<() => void>();
function setState(next: Partial<typeof state>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}
export function subscribeSync(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export const getSyncState = () => state;
const SERVER_STATE = { status: "idle" as SyncStatus, tick: 0 }; // постоянный объект: React требует стабильный снимок
export const getServerSyncState = () => SERVER_STATE;

/** Удалить локальные данные бизнесов (при выходе, смене пользователя, удалении аккаунта). */
export function wipeLocalBusinessData() {
  const list = readJson<any[]>(BUSINESSES_KEY, []);
  const ids = new Set<string>((Array.isArray(list) ? list : []).map((b) => b?.id).filter(Boolean));
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      const m = k?.match(/^promoplan_(?:checklist|funnel|progress|target|level_seen|badges_seen)_(.+)$/);
      if (k && m) ids.add(m[1]);
    }
  } catch {
    // не критично
  }
  ids.forEach((id) => {
    remove(fieldKey.checklist(id));
    remove(fieldKey.funnel(id));
    remove(fieldKey.progress(id));
    remove(fieldKey.target(id));
    remove(`promoplan_level_seen_${id}`); // отметки «уже показали поздравление» — только для этого браузера
    remove(`promoplan_badges_seen_${id}`);
  });
  remove(BUSINESSES_KEY);
  remove(QUEUE_KEY);
  remove(OWNER_KEY);
}

interface ServerBusiness {
  id: string;
  name: string;
  businessType: string;
  createdAt: string;
  plan: unknown;
  vectorId?: string;
  checklist: unknown;
  funnel: unknown;
  progress: unknown;
  target: unknown;
}

let syncing: Promise<void> | null = null;
let lastSyncAt = 0;

export function syncFromServer(userId: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (syncing) return syncing;
  syncing = (async () => {
    if (state.status !== "ready") setState({ status: "syncing" });
    try {
      let owner = get(OWNER_KEY);
      if (owner && owner !== userId) {
        wipeLocalBusinessData(); // в браузере остались данные другого пользователя
        owner = null;
      }
      await flushQueue();

      const res = await fetch("/api/businesses", { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      let server: ServerBusiness[] = ((await res.json()).businesses ?? []) as ServerBusiness[];

      // Первый вход после обновления: данные, жившие только в браузере, переносим в аккаунт
      if (!owner) {
        const onServer = new Set(server.map((b) => b.id));
        const local = readJson<any[]>(BUSINESSES_KEY, []);
        for (const b of Array.isArray(local) ? local : []) {
          if (!b?.id || !b.plan || onServer.has(b.id)) continue;
          const payload = fullPayload(b.id);
          if (payload && (await send("PUT", b.id, payload)) === "ok") {
            server.push({
              id: b.id,
              name: b.name,
              businessType: b.businessType,
              createdAt: b.createdAt,
              plan: b.plan,
              vectorId: b.vectorId,
              checklist: payload.checklist,
              funnel: payload.funnel,
              progress: payload.progress,
              target: payload.target,
            });
          }
        }
      }

      // Записать серверное состояние в кэш; бизнесы с неотправленными изменениями не трогаем
      const queue = readQueue();
      const localNow = readJson<any[]>(BUSINESSES_KEY, []);
      const localList = Array.isArray(localNow) ? localNow : [];
      const next: any[] = [];
      const serverIds = new Set<string>();
      for (const sb of server) {
        serverIds.add(sb.id);
        if (queue[sb.id]) {
          const keep = localList.find((b) => b?.id === sb.id);
          if (keep) next.push(keep);
          continue;
        }
        next.push({
          id: sb.id,
          name: sb.name,
          businessType: sb.businessType,
          createdAt: typeof sb.createdAt === "string" ? sb.createdAt : new Date(sb.createdAt as any).toISOString(),
          plan: sb.plan,
          ...(sb.vectorId ? { vectorId: sb.vectorId } : {}),
        });
        set(fieldKey.checklist(sb.id), JSON.stringify(sb.checklist ?? {}));
        set(fieldKey.funnel(sb.id), JSON.stringify(sb.funnel ?? []));
        set(fieldKey.progress(sb.id), JSON.stringify(sb.progress ?? []));
        set(fieldKey.target(sb.id), JSON.stringify(sb.target ?? {}));
      }
      for (const b of localList) {
        if (!b?.id || serverIds.has(b.id)) continue;
        // нет на сервере: оставляем только ещё не отправленные и старые записи без плана
        if (queue[b.id] || !b.plan) next.push(b);
        else {
          remove(fieldKey.checklist(b.id));
          remove(fieldKey.funnel(b.id));
          remove(fieldKey.progress(b.id));
          remove(fieldKey.target(b.id));
        }
      }
      next.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      set(BUSINESSES_KEY, JSON.stringify(next));
      set(OWNER_KEY, userId);
      lastSyncAt = Date.now();
      setState({ status: "ready", tick: state.tick + 1 });
      window.dispatchEvent(new Event(SYNC_EVENT));
    } catch {
      // сервер недоступен — работаем с локальным кэшем, при следующем заходе повторим
      setState({ status: "error", tick: state.tick + 1 });
    }
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

/** Отправить очередь перед выходом из аккаунта, но не дольше нескольких секунд. */
export async function flushQueueBeforeLogout(): Promise<void> {
  await Promise.race([flushQueue(), new Promise<void>((r) => setTimeout(r, 4000))]);
}

export function resetSyncState() {
  if (state.status !== "idle") setState({ status: "idle" });
}

/** Повторная синхронизация при возврате на вкладку — не чаще раза в минуту. */
export function maybeResync(userId: string) {
  if (Date.now() - lastSyncAt > 60_000) void syncFromServer(userId);
  else void flushQueue();
}
