import {
  createBackgroundController,
  type BackgroundChrome,
} from "./background/controller";
import type {
  CaptureCompleteMessage,
  CaptureErrorMessage,
  CaptureProgressMessage,
  CaptureSlideMessage,
  RuntimeMessage,
} from "./shared/messages";
import { openSessionStore } from "./shared/session-store";

const store = await openSessionStore();
const controller = createBackgroundController({
  chrome: chrome as unknown as BackgroundChrome,
  store,
  now: () => Date.now(),
  uuid: () => crypto.randomUUID(),
});

async function handle(message: RuntimeMessage): Promise<unknown> {
  switch (message.type) {
    case "START_CAPTURE":
      return controller.startCapture();
    case "CAPTURE_SLIDE":
      return controller.handleSlide(message as CaptureSlideMessage);
    case "CAPTURE_PROGRESS":
      await controller.handleProgress(message as CaptureProgressMessage);
      return { ok: true };
    case "CAPTURE_COMPLETE":
      await controller.handleComplete(message as CaptureCompleteMessage);
      return { ok: true };
    case "CAPTURE_ERROR":
      await controller.handleError(message as CaptureErrorMessage);
      return { ok: true };
    default:
      return { ok: false, error: "unknown-message" };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void handle(message as RuntimeMessage)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  void chrome.action.setBadgeBackgroundColor({ color: "#4f46e5" });
});
