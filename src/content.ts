import { advanceSingleSlide } from "./capture/advance-slide";
import {
  captureSlide,
  createCaptureSlideDeps,
} from "./capture/capture-slide";
import { createContentController } from "./content/controller";
import {
  isFetchAssetResponse,
  type FetchAssetMessage,
  type PingMessage,
  type RunCaptureMessage,
} from "./shared/messages";

const slideDeps = createCaptureSlideDeps(async (href) => {
  const response = await chrome.runtime.sendMessage({
    type: "FETCH_ASSET",
    url: href,
  } satisfies FetchAssetMessage);
  if (!isFetchAssetResponse(response)) {
    throw new Error("asset-fetch-failed");
  }
  if (!response.ok) throw new Error(response.error);
  return response.dataUrl;
});

const controller = createContentController({
  runtime: {
    sendMessage: (message) => chrome.runtime.sendMessage(message),
  },
  document,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  capture: () => captureSlide(document, slideDeps),
  advance: () => advanceSingleSlide(document),
});

function isRunCapture(message: unknown): message is RunCaptureMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "RUN_CAPTURE"
  );
}

function isPing(message: unknown): message is PingMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "PING"
  );
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isPing(message)) {
    sendResponse(controller.ping());
    return false;
  }
  if (!isRunCapture(message)) return false;
  sendResponse(controller.run(message));
  return false;
});
