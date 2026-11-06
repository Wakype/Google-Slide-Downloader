import { isAck } from "../shared/messages";
import type {
  Ack,
  CaptureCompleteMessage,
  CaptureErrorMessage,
  CaptureProgressMessage,
  CaptureSlideMessage,
  PingMessage,
  RunCaptureMessage,
  StartCaptureMessage,
  StartCaptureResponse,
} from "../shared/messages";
import { MAX_SLIDES } from "../shared/constants";
import type { SessionStore } from "../shared/session-store";
import type { CaptureSession, SlideRecord } from "../shared/types";
import {
  formatSlideFilename,
  isSlidesPresentationUrl,
  toErrorMessage,
} from "../shared/utils";

export interface TabsApi {
  query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
  update(
    tabId: number,
    properties: chrome.tabs.UpdateProperties,
  ): Promise<chrome.tabs.Tab | undefined>;
  sendMessage(tabId: number, message: unknown): Promise<unknown>;
  create(properties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab>;
}

export interface ScriptingApi {
  executeScript(
    injection: chrome.scripting.ScriptInjection<unknown[], unknown>,
  ): Promise<unknown>;
}

export interface ActionApi {
  setBadgeText(details: chrome.action.BadgeTextDetails): Promise<void>;
  setBadgeBackgroundColor(details: { color: string }): Promise<void>;
}

export interface SessionStorageApi {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface BackgroundChrome {
  tabs: TabsApi;
  scripting: ScriptingApi;
  action: ActionApi;
  storage: { session: SessionStorageApi };
  runtime: { getURL(path: string): string };
}

export interface BackgroundDeps {
  chrome: BackgroundChrome;
  store: SessionStore;
  now: () => number;
  uuid: () => string;
}

export interface BackgroundController {
  startCapture(message: StartCaptureMessage): Promise<StartCaptureResponse>;
  handleSlide(message: CaptureSlideMessage): Promise<Ack>;
  handleProgress(message: CaptureProgressMessage): Promise<void>;
  handleComplete(message: CaptureCompleteMessage): Promise<void>;
  handleError(message: CaptureErrorMessage): Promise<void>;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("invalid-data-url");
  const header = dataUrl.slice(0, comma);
  const encoded = dataUrl.slice(comma + 1);
  const mime = /^data:([^;]+)/.exec(header)?.[1] ?? "image/png";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

export function createBackgroundController(
  deps: BackgroundDeps,
): BackgroundController {
  const activeKey = (tabId: number) => `active:${tabId}`;

  async function setBadge(text: string): Promise<void> {
    await deps.chrome.action.setBadgeText({ text });
  }

  function badgeText(current: number, total: number): string {
    return total > 0 ? `${current}/${total}` : `${current}`;
  }

  async function openPreview(sessionId: string): Promise<void> {
    const url = deps.chrome.runtime.getURL(
      `preview.html?session=${encodeURIComponent(sessionId)}`,
    );
    await deps.chrome.tabs.create({ url });
  }

  async function captureIsAlive(tabId: number): Promise<boolean> {
    try {
      const response = await deps.chrome.tabs.sendMessage(tabId, {
        type: "PING",
      } satisfies PingMessage);
      return (
        typeof response === "object" &&
        response !== null &&
        (response as { ok?: unknown }).ok === true &&
        (response as { running?: unknown }).running === true
      );
    } catch {
      return false;
    }
  }

  async function sendRunCapture(
    tabId: number,
    message: RunCaptureMessage,
  ): Promise<Ack> {
    const response = await deps.chrome.tabs.sendMessage(tabId, message);
    return isAck(response) ? response : { ok: false, error: "content-not-ready" };
  }

  async function failStart(
    sessionId: string,
    tabId: number,
    error: string,
  ): Promise<StartCaptureResponse> {
    await deps.store.updateSession(sessionId, { status: "error", error });
    await deps.chrome.storage.session.remove(activeKey(tabId));
    await setBadge("");
    return { ok: false, error };
  }

  async function startCapture(
    message: StartCaptureMessage,
  ): Promise<StartCaptureResponse> {
    const requestedLimit = message.limit;
    if (
      requestedLimit !== null &&
      (!Number.isInteger(requestedLimit) ||
        requestedLimit < 1 ||
        requestedLimit > MAX_SLIDES)
    ) {
      return {
        ok: false,
        error: `Enter a slide count between 1 and ${MAX_SLIDES}.`,
      };
    }

    const [tab] = await deps.chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      return { ok: false, error: "No active tab was found." };
    }

    const sourceUrl = tab.url ?? tab.pendingUrl ?? "";
    if (!isSlidesPresentationUrl(sourceUrl)) {
      return {
        ok: false,
        error:
          "Open a published Google Slides deck (/pub, /pubembed, /embed, or /preview) first.",
      };
    }

    const key = activeKey(tab.id);
    const existing = await deps.chrome.storage.session.get(key);
    const existingId = existing[key];
    if (typeof existingId === "string") {
      const session = await deps.store.getSession(existingId);
      if (session?.status === "capturing") {
        const alive = await captureIsAlive(tab.id);
        if (alive) {
          return {
            ok: false,
            error: "A capture is already running in this tab.",
          };
        }
        await deps.store.updateSession(existingId, {
          status: "error",
          error: "The previous capture was interrupted.",
        });
      }
      await deps.chrome.storage.session.remove(key);
    }

    const sessionId = deps.uuid();
    const title = tab.title?.trim() || "Google Slides";
    const session: CaptureSession = {
      id: sessionId,
      tabId: tab.id,
      sourceUrl,
      title,
      createdAt: deps.now(),
      total: null,
      limit: requestedLimit,
      captured: 0,
      failed: [],
      status: "capturing",
      error: null,
      reachedEnd: false,
    };

    await deps.store.createSession(session);
    await deps.chrome.storage.session.set({ [key]: sessionId });
    await deps.chrome.tabs.update(tab.id, { active: true });
    await setBadge("0");

    const runMessage: RunCaptureMessage = {
      type: "RUN_CAPTURE",
      sessionId,
      sourceUrl,
      title,
      limit: requestedLimit,
    };

    let ack: Ack;
    try {
      ack = await sendRunCapture(tab.id, runMessage);
    } catch {
      try {
        await deps.chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        });
        ack = await sendRunCapture(tab.id, runMessage);
      } catch {
        return failStart(
          sessionId,
          tab.id,
          "Could not connect to the presentation tab. Reload it and try again.",
        );
      }
    }

    if (!ack.ok) {
      return failStart(sessionId, tab.id, ack.error);
    }

    return { ok: true, sessionId };
  }

  async function handleSlide(message: CaptureSlideMessage): Promise<Ack> {
    const session = await deps.store.getSession(message.sessionId);
    if (!session) return { ok: false, error: "session-not-found" };
    if (session.status !== "capturing") {
      return { ok: false, error: "capture-not-running" };
    }

    try {
      const blob = dataUrlToBlob(message.dataUrl);
      const slide: SlideRecord = {
        id: `${message.sessionId}:${message.index}`,
        sessionId: message.sessionId,
        index: message.index,
        filename: formatSlideFilename(message.index),
        blob,
        width: message.width,
        height: message.height,
        warning: message.warning ?? null,
      };
      await deps.store.putSlide(slide);
      const captured = session.captured + 1;
      await deps.store.updateSession(message.sessionId, {
        captured,
        total: message.total > 0 ? message.total : null,
      });
      await setBadge(badgeText(captured, message.total));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toErrorMessage(error) };
    }
  }

  async function handleProgress(
    message: CaptureProgressMessage,
  ): Promise<void> {
    const session = await deps.store.getSession(message.sessionId);
    if (!session) return;
    await deps.store.updateSession(message.sessionId, {
      total: message.total > 0 ? message.total : null,
      failed: message.failed,
    });
    await setBadge(badgeText(message.current, message.total));
  }

  async function finishSession(
    sessionId: string,
    patch: Partial<CaptureSession>,
    badge: string,
  ): Promise<void> {
    const updated = await deps.store.updateSession(sessionId, patch);
    await deps.chrome.storage.session.remove(activeKey(updated.tabId));
    await setBadge(badge);
    await openPreview(sessionId);
  }

  async function handleComplete(
    message: CaptureCompleteMessage,
  ): Promise<void> {
    await finishSession(
      message.sessionId,
      {
        status: "complete",
        captured: message.captured,
        total: message.total,
        failed: message.failed,
        reachedEnd: message.reachedEnd,
        error: null,
      },
      "✓",
    );
  }

  async function handleError(message: CaptureErrorMessage): Promise<void> {
    const existing = await deps.store.getSession(message.sessionId);
    await finishSession(
      message.sessionId,
      {
        status: "error",
        captured: Math.max(existing?.captured ?? 0, message.captured),
        total:
          message.total > 0 ? message.total : (existing?.total ?? null),
        failed:
          message.failed.length > 0
            ? message.failed
            : (existing?.failed ?? []),
        error: message.error,
      },
      "!",
    );
  }

  return {
    startCapture,
    handleSlide,
    handleProgress,
    handleComplete,
    handleError,
  };
}
