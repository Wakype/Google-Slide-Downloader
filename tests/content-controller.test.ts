import { describe, expect, it, vi } from "vitest";
import { createContentController } from "../src/content/controller";
import type { RunCaptureOptions } from "../src/capture/run-capture";
import type { RuntimeMessage } from "../src/shared/messages";
import type { CaptureSummary } from "../src/shared/types";

const runMessage = {
  type: "RUN_CAPTURE" as const,
  sessionId: "session-1",
  sourceUrl: "https://docs.google.com/presentation/d/e/abc/pub",
  title: "Deck",
};

const summary: CaptureSummary = {
  total: 2,
  captured: 1,
  failed: [2],
  reachedEnd: false,
  cancelled: false,
  error: null,
};

function createRuntime(
  responder: (message: RuntimeMessage) => unknown = () => ({ ok: true }),
) {
  const messages: RuntimeMessage[] = [];
  return {
    messages,
    runtime: {
      sendMessage: vi.fn(async (message: unknown) => {
        messages.push(message as RuntimeMessage);
        return responder(message as RuntimeMessage);
      }),
    },
  };
}

describe("content capture controller", () => {
  it("sends progress, slides, and a completion message", async () => {
    const { messages, runtime } = createRuntime();
    const runCaptureImpl = vi.fn(async (options: RunCaptureOptions) => {
      await options.onProgress({ current: 1, total: 2, failed: [] });
      await options.onSlide({
        index: 1,
        dataUrl: "data:image/png;base64,AAAA",
        width: 1920,
        height: 1080,
        warning: null,
      });
      await options.onProgress({ current: 2, total: 2, failed: [2] });
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

    expect(controller.run(runMessage)).toEqual({ ok: true });
    await controller.whenIdle();

    expect(messages.map((message) => message.type)).toEqual([
      "CAPTURE_PROGRESS",
      "CAPTURE_SLIDE",
      "CAPTURE_PROGRESS",
      "CAPTURE_COMPLETE",
    ]);
    expect(messages[1]).toMatchObject({
      type: "CAPTURE_SLIDE",
      sessionId: "session-1",
      index: 1,
      total: 2,
    });
    expect(messages[3]).toMatchObject({
      type: "CAPTURE_COMPLETE",
      captured: 1,
      failed: [2],
    });
  });

  it("reports whether a capture is running", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    const { runtime } = createRuntime();
    const controller = createContentController({
      runtime,
      document,
      sleep: () => Promise.resolve(),
      capture: vi.fn(),
      advance: vi.fn(),
      runCaptureImpl: vi.fn(async () => {
        await gate;
        return summary;
      }),
    });

    expect(controller.ping()).toEqual({ ok: true, running: false });
    controller.run(runMessage);
    expect(controller.ping()).toEqual({ ok: true, running: true });

    release();
    await controller.whenIdle();
    expect(controller.ping()).toEqual({ ok: true, running: false });
  });

  it("rejects a second run while one is in progress", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = () => resolve();
    });
    const runCaptureImpl = vi.fn(async (_options: RunCaptureOptions) => {
      await gate;
      return summary;
    });
    const { runtime } = createRuntime();

    const controller = createContentController({
      runtime,
      document,
      sleep: () => Promise.resolve(),
      capture: vi.fn(),
      advance: vi.fn(),
      runCaptureImpl,
    });

    expect(controller.run(runMessage)).toEqual({ ok: true });
    expect(controller.run(runMessage)).toEqual({
      ok: false,
      error: "already-running",
    });

    release();
    await controller.whenIdle();
  });

  it("sends an error message when the run reports one", async () => {
    const { messages, runtime } = createRuntime();
    const controller = createContentController({
      runtime,
      document,
      sleep: () => Promise.resolve(),
      capture: vi.fn(),
      advance: vi.fn(),
      runCaptureImpl: vi.fn(async () => ({
        ...summary,
        error: "capture exploded",
      })),
    });

    controller.run(runMessage);
    await controller.whenIdle();

    expect(messages.at(-1)).toMatchObject({
      type: "CAPTURE_ERROR",
      error: "capture exploded",
    });
  });

  it("aborts and reports when the worker refuses a slide", async () => {
    const { messages, runtime } = createRuntime((message) =>
      message.type === "CAPTURE_SLIDE"
        ? { ok: false, error: "storage-full" }
        : { ok: true },
    );
    const runCaptureImpl = vi.fn(async (options: RunCaptureOptions) => {
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
      error: "storage-full",
    });
  });
});
