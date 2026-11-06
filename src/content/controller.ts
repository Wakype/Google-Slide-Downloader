import { TIMING } from "../shared/constants";
import type {
  Ack,
  CaptureCompleteMessage,
  CaptureErrorMessage,
  CaptureProgressMessage,
  CaptureSlideMessage,
  RunCaptureMessage,
} from "../shared/messages";
import { isAck } from "../shared/messages";
import type {
  CaptureResult,
  CaptureSummary,
  CapturedSlide,
} from "../shared/types";
import { toErrorMessage } from "../shared/utils";
import { runCapture, type RunCaptureOptions } from "../capture/run-capture";

export interface ContentRuntime {
  sendMessage(message: unknown): Promise<unknown>;
}

export interface ContentControllerDeps {
  runtime: ContentRuntime;
  document: Document;
  sleep: (ms: number) => Promise<void>;
  capture: (index: number) => Promise<CaptureResult>;
  advance: () => Promise<boolean>;
  runCaptureImpl?: typeof runCapture;
}

export interface ContentController {
  isRunning(): boolean;
  run(message: RunCaptureMessage): Ack;
  whenIdle(): Promise<void>;
}

export function createContentController(
  deps: ContentControllerDeps,
): ContentController {
  const runCaptureImpl = deps.runCaptureImpl ?? runCapture;
  let currentRun: Promise<void> | null = null;

  async function execute(message: RunCaptureMessage): Promise<void> {
    let total = 0;
    let summary: CaptureSummary = {
      total: 0,
      captured: 0,
      failed: [],
      reachedEnd: false,
      cancelled: false,
      error: null,
    };

    try {
      const options: RunCaptureOptions = {
        document: deps.document,
        sleep: deps.sleep,
        capture: deps.capture,
        advance: deps.advance,
        onSlide: async (slide: CapturedSlide) => {
          const payload: CaptureSlideMessage = {
            type: "CAPTURE_SLIDE",
            sessionId: message.sessionId,
            index: slide.index,
            total,
            dataUrl: slide.dataUrl,
            width: slide.width,
            height: slide.height,
          };
          const response = await deps.runtime.sendMessage(payload);
          if (!isAck(response)) throw new Error("slide-not-stored");
          if (!response.ok) throw new Error(response.error);
        },
        onProgress: async (progress) => {
          total = progress.total;
          const payload: CaptureProgressMessage = {
            type: "CAPTURE_PROGRESS",
            sessionId: message.sessionId,
            current: progress.current,
            total: progress.total,
            failed: progress.failed,
          };
          await deps.runtime.sendMessage(payload);
        },
        settleMs: TIMING.settleMs,
        advanceAttempts: TIMING.advanceAttempts,
        advanceRetryMs: TIMING.advanceRetryMs,
      };

      summary = await runCaptureImpl(options);
    } catch (error) {
      summary = { ...summary, error: toErrorMessage(error) };
    }

    try {
      if (summary.error) {
        const payload: CaptureErrorMessage = {
          type: "CAPTURE_ERROR",
          sessionId: message.sessionId,
          total: summary.total,
          captured: summary.captured,
          failed: summary.failed,
          error: summary.error,
        };
        await deps.runtime.sendMessage(payload);
      } else {
        const payload: CaptureCompleteMessage = {
          type: "CAPTURE_COMPLETE",
          sessionId: message.sessionId,
          total: summary.total,
          captured: summary.captured,
          failed: summary.failed,
          reachedEnd: summary.reachedEnd,
        };
        await deps.runtime.sendMessage(payload);
      }
    } catch {
      // The worker may be gone; the captured slides are already persisted.
    }
  }

  function run(message: RunCaptureMessage): Ack {
    if (currentRun) return { ok: false, error: "already-running" };
    currentRun = execute(message).finally(() => {
      currentRun = null;
    });
    return { ok: true };
  }

  return {
    isRunning: () => currentRun !== null,
    run,
    whenIdle: async () => {
      await currentRun;
    },
  };
}
