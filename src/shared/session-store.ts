import {
  DB_NAME,
  DB_VERSION,
  SESSION_STORE,
  SLIDE_SESSION_INDEX,
  SLIDE_STORE,
} from "./constants";
import type { CaptureSession, SlideRecord } from "./types";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("indexeddb-request-failed"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("indexeddb-transaction-failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("indexeddb-transaction-aborted"));
  });
}

function upgrade(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains(SESSION_STORE)) {
    database.createObjectStore(SESSION_STORE, { keyPath: "id" });
  }
  if (!database.objectStoreNames.contains(SLIDE_STORE)) {
    const slides = database.createObjectStore(SLIDE_STORE, { keyPath: "id" });
    slides.createIndex(SLIDE_SESSION_INDEX, "sessionId", { unique: false });
  }
}

export function openDatabase(
  factory: IDBFactory = indexedDB,
  name = DB_NAME,
  version = DB_VERSION,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const openRequest = factory.open(name, version);
    openRequest.onupgradeneeded = () => upgrade(openRequest.result);
    openRequest.onsuccess = () => resolve(openRequest.result);
    openRequest.onerror = () =>
      reject(openRequest.error ?? new Error("indexeddb-open-failed"));
    openRequest.onblocked = () => reject(new Error("indexeddb-open-blocked"));
  });
}

export class SessionStore {
  constructor(private readonly database: IDBDatabase) {}

  async createSession(session: CaptureSession): Promise<void> {
    const transaction = this.database.transaction(SESSION_STORE, "readwrite");
    transaction.objectStore(SESSION_STORE).put(session);
    await transactionDone(transaction);
  }

  async getSession(id: string): Promise<CaptureSession | undefined> {
    const transaction = this.database.transaction(SESSION_STORE, "readonly");
    return requestToPromise(
      transaction.objectStore(SESSION_STORE).get(id) as IDBRequest<
        CaptureSession | undefined
      >,
    );
  }

  async updateSession(
    id: string,
    patch: Partial<CaptureSession>,
  ): Promise<CaptureSession> {
    const transaction = this.database.transaction(SESSION_STORE, "readwrite");
    const store = transaction.objectStore(SESSION_STORE);
    const existing = await requestToPromise(
      store.get(id) as IDBRequest<CaptureSession | undefined>,
    );
    if (!existing) {
      transaction.abort();
      throw new Error("session-not-found");
    }
    const updated = { ...existing, ...patch, id };
    store.put(updated);
    await transactionDone(transaction);
    return updated;
  }

  async putSlide(slide: SlideRecord): Promise<void> {
    const transaction = this.database.transaction(SLIDE_STORE, "readwrite");
    transaction.objectStore(SLIDE_STORE).put(slide);
    await transactionDone(transaction);
  }

  async getSlides(sessionId: string): Promise<SlideRecord[]> {
    const transaction = this.database.transaction(SLIDE_STORE, "readonly");
    const store = transaction.objectStore(SLIDE_STORE);
    const slides = await requestToPromise(
      store.index(SLIDE_SESSION_INDEX).getAll(sessionId) as IDBRequest<
        SlideRecord[]
      >,
    );
    return slides.sort((left, right) => left.index - right.index);
  }

  async countSlides(sessionId: string): Promise<number> {
    const transaction = this.database.transaction(SLIDE_STORE, "readonly");
    return requestToPromise(
      transaction
        .objectStore(SLIDE_STORE)
        .index(SLIDE_SESSION_INDEX)
        .count(sessionId),
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    const transaction = this.database.transaction(
      [SESSION_STORE, SLIDE_STORE],
      "readwrite",
    );
    transaction.objectStore(SESSION_STORE).delete(sessionId);
    const keys = await requestToPromise(
      transaction
        .objectStore(SLIDE_STORE)
        .index(SLIDE_SESSION_INDEX)
        .getAllKeys(sessionId),
    );
    const slideStore = transaction.objectStore(SLIDE_STORE);
    for (const key of keys) slideStore.delete(key);
    await transactionDone(transaction);
  }

  close(): void {
    this.database.close();
  }
}

export function openSessionStore(
  factory: IDBFactory = indexedDB,
  name = DB_NAME,
): Promise<SessionStore> {
  return openDatabase(factory, name).then(
    (database) => new SessionStore(database),
  );
}
