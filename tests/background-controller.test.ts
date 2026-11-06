import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBackgroundController,
  dataUrlToBlob,
  type BackgroundChrome,
} from "../src/background/controller";
import {
  openSessionStore,
  type SessionStore,
} from "../src/shared/session-store";
import type { CaptureSession } from "../src/shared/types";

interface FakeChrome {
  api: BackgroundChrome;
  sessionStorage: Map<string, unknown>;
  tabs: {
    query: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  action: {
    setBadgeText: ReturnType<typeof vi.fn>;
  };
  scripting: {
    executeScript: ReturnType<typeof vi.fn>;
  };
}

const tab = {
  id: 7,
  url: "https://docs.google.com/presentation/d/e/abc/pub",
  title: "My Deck",
} as chrome.tabs.Tab;

function createFakeChrome(): FakeChrome {
  const sessionStorage = new Map<string, unknown>();

  const tabs = {
    query: vi.fn(async () => [tab]),
    update: vi.fn(async () => tab),
    sendMessage: vi.fn(async (_tabId: number, message: unknown) => {
      if ((message as { type?: string }).type === "PING") {
        return { ok: true, running: true };
      }
      return { ok: true };
    }),
    create: vi.fn(async () => ({ id: 99 }) as chrome.tabs.Tab),
  };
  const action = {
    setBadgeText: vi.fn(async () => undefined),
    setBadgeBackgroundColor: vi.fn(async () => undefined),
  };
  const scripting = {
    executeScript: vi.fn(async () => []),
  };

  const api: BackgroundChrome = {
    tabs,
    action,
    scripting,
    storage: {
      session: {
        get: vi.fn(async (key: string) => ({ [key]: sessionStorage.get(key) })),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) {
            sessionStorage.set(key, value);
          }
        }),
        remove: vi.fn(async (key: string) => {
          sessionStorage.delete(key);
        }),
      },
    },
    runtime: {
      getURL: (path: string) => `chrome-extension://test/${path}`,
    },
  };

  return { api, sessionStorage, tabs, action, scripting };
}

function baseSession(id: string): CaptureSession {
  return {
    id,
    tabId: 7,
    sourceUrl: tab.url ?? "",
    title: "My Deck",
    createdAt: 1_000,
    total: 3,
    limit: null,
    captured: 0,
    failed: [],
    status: "capturing",
    error: null,
    reachedEnd: false,
  };
}

let store: SessionStore;
let databaseCounter = 0;

beforeEach(async () => {
  databaseCounter += 1;
  store = await openSessionStore(indexedDB, `background-test-${databaseCounter}`);
});

afterEach(() => {
  store.close();
});

describe("background capture controller", () => {
  it("starts a capture on a supported tab and focuses it", async () => {
    const chrome = createFakeChrome();
    const controller = createBackgroundController({
      chrome: chrome.api,
      store,
      now: () => 5_000,
      uuid: () => "session-1",
    });

    const result = await controller.startCapture({ type: "START_CAPTURE", limit: null });

    expect(result).toEqual({ ok: true, sessionId: "session-1" });
    expect(await store.getSession("session-1")).toMatchObject({
      tabId: 7,
      title: "My Deck",
      status: "capturing",
      createdAt: 5_000,
    });
    expect(chrome.tabs.update).toHaveBeenCalledWith(7, { active: true });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        type: "RUN_CAPTURE",
        sessionId: "session-1",
      }),
    );
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "0" });
    expect(chrome.sessionStorage.get("active:7")).toBe("session-1");
  });

  it("stores and forwards a requested slide limit", async () => {
    const chrome = createFakeChrome();
    const controller = createBackgroundController({
      chrome: chrome.api,
      store,
      now: () => 1,
      uuid: () => "session-1",
    });

    const result = await controller.startCapture({
      type: "START_CAPTURE",
      limit: 5,
    });

    expect(result.ok).toBe(true);
    expect((await store.getSession("session-1"))?.limit).toBe(5);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ type: "RUN_CAPTURE", limit: 5 }),
    );
  });

  it("rejects an invalid slide limit before touching the tab", async () => {
    const chrome = createFakeChrome();
    const controller = createBackgroundController({
      chrome: chrome.api,
      store,
      now: () => 1,
      uuid: () => "session-1",
    });

    const result = await controller.startCapture({
      type: "START_CAPTURE",
      limit: 0,
    });

    expect(result.ok).toBe(false);
    expect(chrome.tabs.query).not.toHaveBeenCalled();
  });

  it("rejects unsupported pages", async () => {
    const chrome = createFakeChrome();
    chrome.tabs.query.mockResolvedValueOnce([
      { ...tab, url: "https://docs.google.com/presentation/d/abc/edit" },
    ]);
    const controller = createBackgroundController({
      chrome: chrome.api,
      store,
      now: () => 1,
      uuid: () => "session-1",
    });

    const result = await controller.startCapture({ type: "START_CAPTURE", limit: null });

    expect(result.ok).toBe(false);
    expect(chrome.tabs.sendMessage).not.toHaveBeenCalled();
    expect(await store.getSession("session-1")).toBeUndefined();
  });

  it("rejects a second capture already running in the same tab", async () => {
    const chrome = createFakeChrome();
    await store.createSession(baseSession("existing"));
    chrome.sessionStorage.set("active:7", "existing");
    const controller = createBackgroundController({
      chrome: chrome.api,
      store,
      now: () => 1,
      uuid: () => "session-2",
    });

    const result = await controller.startCapture({ type: "START_CAPTURE", limit: null });

    expect(result).toEqual({
      ok: false,
      error: "A capture is already running in this tab.",
    });
    expect(await store.getSession("session-2")).toBeUndefined();
  });

  it("recovers a stale capturing session when the tab is no longer running", async () => {
    const chrome = createFakeChrome();
    await store.createSession({ ...baseSession("stale"), createdAt: 0 });
    chrome.sessionStorage.set("active:7", "stale");
    chrome.tabs.sendMessage.mockImplementation(
      async (_tabId: number, message: unknown) => {
        if ((message as { type?: string }).type === "PING") {
          return { ok: true, running: false };
        }
        return { ok: true };
      },
    );
    const controller = createBackgroundController({
      chrome: chrome.api,
      store,
      now: () => 1,
      uuid: () => "session-2",
    });

    const result = await controller.startCapture({ type: "START_CAPTURE", limit: null });

    expect(result.ok).toBe(true);
    expect((await store.getSession("stale"))?.status).toBe("error");
    expect(chrome.sessionStorage.get("active:7")).toBe("session-2");
  });

  it("recovers when the stale tab has no content receiver", async () => {
    const chrome = createFakeChrome();
    await store.createSession({ ...baseSession("stale"), createdAt: 0 });
    chrome.sessionStorage.set("active:7", "stale");
    chrome.tabs.sendMessage.mockImplementation(
      async (_tabId: number, message: unknown) => {
        if ((message as { type?: string }).type === "PING") {
          throw new Error("no receiver");
        }
        return { ok: true };
      },
    );
    const controller = createBackgroundController({
      chrome: chrome.api,
      store,
      now: () => 1,
      uuid: () => "session-2",
    });

    const result = await controller.startCapture({ type: "START_CAPTURE", limit: null });

    expect(result.ok).toBe(true);
    expect((await store.getSession("stale"))?.status).toBe("error");
  });

  it("reports a content-script refusal instead of a phantom success", async () => {
    const chrome = createFakeChrome();
    chrome.tabs.sendMessage.mockImplementation(
      async (_tabId: number, message: unknown) => {
        if ((message as { type?: string }).type === "PING") {
          return { ok: true, running: false };
        }
        return { ok: false, error: "already-running" };
      },
    );
    const controller = createBackgroundController({
      chrome: chrome.api,
      store,
      now: () => 1,
      uuid: () => "session-1",
    });

    const result = await controller.startCapture({ type: "START_CAPTURE", limit: null });

    expect(result).toEqual({ ok: false, error: "already-running" });
    expect((await store.getSession("session-1"))?.status).toBe("error");
    expect(chrome.sessionStorage.has("active:7")).toBe(false);
    expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" });
  });

  it("injects the content script when the tab has no receiver", async () => {
    const chrome = createFakeChrome();
    chrome.tabs.sendMessage
      .mockRejectedValueOnce(new Error("no receiver"))
      .mockResolvedValueOnce({ ok: true });
    const controller = createBackgroundController({
      chrome: chrome.api,
      store,
      now: () => 1,
      uuid: () => "session-1",
    });

    const result = await controller.startCapture({ type: "START_CAPTURE", limit: null });

    expect(result.ok).toBe(true);
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ["content.js"],
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
  });

  it("stores a slide blob and advances the badge", async () => {
    const chrome = createFakeChrome();
    await store.createSession(baseSession("session-1"));
    const controller = createBackgroundController({
      chrome: chrome.api,
      store,
      now: () => 1,
      uuid: () => "unused",
    });

    const ack = await controller.handleSlide({
      type: "CAPTURE_SLIDE",
      sessionId: "session-1",
      index: 1,
      total: 3,
      dataUrl: "data:image/png;base64,aGVsbG8=",
      width: 1920,
      height: 1080,
      warning: "1 embedded image could not be inlined.",
    });

    expect(ack).toEqual({ ok: true });
    const slides = await store.getSlides("session-1");
    expect(slides).toHaveLength(1);
    expect(slides[0]).toMatchObject({
      index: 1,
      filename: "slide_001.png",
      width: 1920,
      height: 1080,
      warning: "1 embedded image could not be inlined.",
    });
    expect(slides[0]?.blob.size).toBe(5);
    expect((await store.getSession("session-1"))?.captured).toBe(1);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "1/3" });
  });

  it("updates progress and failed indexes", async () => {
    const chrome = createFakeChrome();
    await store.createSession(baseSession("session-1"));
    const controller = createBackgroundController({
      chrome: chrome.api,
      store,
      now: () => 1,
      uuid: () => "unused",
    });

    await controller.handleProgress({
      type: "CAPTURE_PROGRESS",
      sessionId: "session-1",
      current: 2,
      total: 3,
      failed: [2],
    });

    const session = await store.getSession("session-1");
    expect(session?.total).toBe(3);
    expect(session?.failed).toEqual([2]);
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "2/3" });
  });

  it("opens the preview when capture completes", async () => {
    const chrome = createFakeChrome();
    await store.createSession(baseSession("session-1"));
    chrome.sessionStorage.set("active:7", "session-1");
    const controller = createBackgroundController({
      chrome: chrome.api,
      store,
      now: () => 1,
      uuid: () => "unused",
    });

    await controller.handleComplete({
      type: "CAPTURE_COMPLETE",
      sessionId: "session-1",
      total: 3,
      captured: 3,
      failed: [],
      reachedEnd: true,
    });

    const session = await store.getSession("session-1");
    expect(session?.status).toBe("complete");
    expect(session?.reachedEnd).toBe(true);
    expect(chrome.sessionStorage.has("active:7")).toBe(false);
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://test/preview.html?session=session-1",
    });
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "✓" });
  });

  it("opens the preview with partial results on error", async () => {
    const chrome = createFakeChrome();
    await store.createSession(baseSession("session-1"));
    const controller = createBackgroundController({
      chrome: chrome.api,
      store,
      now: () => 1,
      uuid: () => "unused",
    });

    await controller.handleError({
      type: "CAPTURE_ERROR",
      sessionId: "session-1",
      total: 3,
      captured: 1,
      failed: [3],
      error: "quota exceeded",
    });

    const session = await store.getSession("session-1");
    expect(session?.status).toBe("error");
    expect(session?.error).toBe("quota exceeded");
    expect(session?.captured).toBe(1);
    expect(chrome.tabs.create).toHaveBeenCalled();
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "!" });
  });
});

describe("dataUrlToBlob", () => {
  it("decodes a base64 data URL", () => {
    const blob = dataUrlToBlob("data:image/png;base64,aGVsbG8=");
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(5);
  });
});
