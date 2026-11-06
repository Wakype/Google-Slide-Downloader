import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBackgroundController,
  type BackgroundChrome,
} from "../src/background/controller";
import {
  openSessionStore,
  type SessionStore,
} from "../src/shared/session-store";
import type { CaptureSession } from "../src/shared/types";

let store: SessionStore;
let databaseCounter = 0;

function session(): CaptureSession {
  return {
    id: "session-1",
    tabId: 7,
    sourceUrl: "https://docs.google.com/presentation/d/e/abc/pub",
    title: "Deck",
    createdAt: 1_000,
    total: 5,
    captured: 3,
    failed: [4],
    status: "capturing",
    error: null,
    reachedEnd: false,
  };
}

function chromeApi(): BackgroundChrome {
  return {
    tabs: {
      query: vi.fn(async () => []),
      update: vi.fn(async () => undefined),
      sendMessage: vi.fn(async () => ({ ok: true })),
      create: vi.fn(async () => ({ id: 1 }) as chrome.tabs.Tab),
    },
    scripting: {
      executeScript: vi.fn(async () => []),
    },
    action: {
      setBadgeText: vi.fn(async () => undefined),
      setBadgeBackgroundColor: vi.fn(async () => undefined),
    },
    storage: {
      session: {
        get: vi.fn(async () => ({})),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
      },
    },
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
  };
}

beforeEach(async () => {
  databaseCounter += 1;
  store = await openSessionStore(indexedDB, `error-counts-${databaseCounter}`);
});

afterEach(() => {
  store.close();
});

describe("background error handling counts", () => {
  it("does not erase stored counts when the error message carries zeros", async () => {
    await store.createSession(session());
    const controller = createBackgroundController({
      chrome: chromeApi(),
      store,
      now: () => 2_000,
      uuid: () => "unused",
    });

    await controller.handleError({
      type: "CAPTURE_ERROR",
      sessionId: "session-1",
      total: 0,
      captured: 0,
      failed: [],
      error: "worker stopped",
    });

    const updated = await store.getSession("session-1");
    expect(updated?.status).toBe("error");
    expect(updated?.captured).toBe(3);
    expect(updated?.total).toBe(5);
    expect(updated?.failed).toEqual([4]);
  });
});
