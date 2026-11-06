import { describe, expect, it, vi } from "vitest";
import type { RunCaptureOptions } from "../src/capture/run-capture";
import { createContentController } from "../src/content/controller";
import type { RuntimeMessage } from "../src/shared/messages";
import type { CaptureSummary } from "../src/shared/types";

const runMessage = {
  type: "RUN_CAPTURE" as const,
  sessionId: "session-1",
  sourceUrl: "https://docs.google.com/presentation/d/e/abc/pub",
  title: "Deck",
  limit: null,
};

const summary: CaptureSummary = {
  total: 4,
  captured: 0,
  failed: [],
  reachedEnd: false,
  cancelled: false,
  error: null,
};

describe("content capture controller counts", () => {
  it("preserves the progress total when the worker refuses a slide", async () => {
    const messages: RuntimeMessage[] = [];
    const runtime = {
      sendMessage: vi.fn(async (message: unknown) => {
        const typed = message as RuntimeMessage;
        messages.push(typed);
        return typed.type === "CAPTURE_SLIDE"
          ? { ok: false, error: "storage-full" }
          : { ok: true };
      }),
    };
    const runCaptureImpl = vi.fn(async (options: RunCaptureOptions) => {
      await options.onProgress({ current: 1, total: 4, failed: [] });
      await options.onSlide({
        index: 1,
        dataUrl: "data:image/png;base64,AAAA",
        width: 1920,
        height: 1080,
        warning: null,
      });
      return summary;
    });

    const controller = createContentController({
      runtime,
      document,
      sleep: () => Promise.resolve(),
      capture: vi.fn(),
      advance: vi.fn(),
      runCaptureImpl,
    });

    controller.run(runMessage);
    await controller.whenIdle();

    expect(messages.at(-1)).toMatchObject({
      type: "CAPTURE_ERROR",
      total: 4,
      captured: 0,
      failed: [],
    });
  });
});
