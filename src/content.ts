import { advanceSingleSlide } from "./capture/advance-slide";
import {
  captureSlide,
  createCaptureSlideDeps,
} from "./capture/capture-slide";
import { createContentController } from "./content/controller";
import type { RunCaptureMessage } from "./shared/messages";

const slideDeps = createCaptureSlideDeps();

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isRunCapture(message)) return false;
  sendResponse(controller.run(message));
  return false;
});
