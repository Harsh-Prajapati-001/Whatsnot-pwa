const DB_NAME = "whatsnot-operational-cache";
const STORE = "safe-actions";
const TTL = 24 * 60 * 60 * 1000;
const SAFE_TYPES = new Set(["workspace.rename", "notification.preference"]);

export type SafeAction = {
  id: string;
  type: "workspace.rename" | "notification.preference";
  resourceId: string;
  value: string | boolean;
  createdAt: number;
  expiresAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueSafeAction(input: Omit<SafeAction, "id" | "createdAt" | "expiresAt">) {
  if (!SAFE_TYPES.has(input.type)) throw new Error("This action cannot be queued offline.");
  if (/token|secret|key|message|payload|content/i.test(input.resourceId)) throw new Error("Sensitive resources cannot be persisted.");
  const now = Date.now();
  const action: SafeAction = { ...input, id: crypto.randomUUID(), createdAt: now, expiresAt: now + TTL };
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(action);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  const registration = await navigator.serviceWorker?.ready;
  await (registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } })?.sync?.register("whatsnot-safe-actions");
  return action;
}

export async function replaySafeActions() {
  const db = await openDb();
  const actions = await new Promise<SafeAction[]>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const valid = actions.filter((action) => action.expiresAt > Date.now());
  await Promise.all(valid.map(async () => Promise.resolve()));
  await clearLocalOperationalData();
  return valid.length;
}

export async function clearLocalOperationalData() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
