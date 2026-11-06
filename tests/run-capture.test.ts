import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCapture } from "../src/capture/run-capture";
import type { CaptureResult } from "../src/shared/types";

const okResult = (index: number): CaptureResult => ({
  ok: true,
  dataUrl: `data:image/png;base64,SLIDE_${index}`,
  width: 1920,
  height: 1080,
  reason: null,
  warning: null,
});

const failedResult: CaptureResult = {
  ok: false,
  dataUrl: null,
  width: 0,
  height: 0,
  reason: "rasterize-failed",
  warning: null,
};

const immediateSleep = () => Promise.resolve();

beforeEach(() => {
  document.body.innerHTML = `<div aria-setsize="3"></div>`;
});

describe("runCapture", () => {
  it("captures every expected slide and advances between them", async () => {
    const capture = vi.fn((index: number) => Promise.resolve(okResult(index)));
    const advance = vi.fn(() => Promise.resolve(true));
    const onSlide = vi.fn(() => Promise.resolve());
    const onProgress = vi.fn();

    const summary = await runCapture({
      document,
      sleep: immediateSleep,
      capture,
      advance,
      onSlide,
      onProgress,
      settleMs: 0,
    });

    expect(capture.mock.calls.map(([index]) => index)).toEqual([1, 2, 3]);
    expect(advance).toHaveBeenCalledTimes(2);
    expect(onSlide).toHaveBeenCalledTimes(3);
    expect(summary).toEqual({
      total: 3,
      captured: 3,
      failed: [],
      reachedEnd: false,
      cancelled: false,
      error: null,
    });
  });

  it("captures only the requested number of slides but reports the deck total", async () => {
    document.body.innerHTML = `<div aria-setsize="5"></div>`;
    const capture = vi.fn((index: number) => Promise.resolve(okResult(index)));
    const onProgress = vi.fn();

    const summary = await runCapture({
      document,
      sleep: immediateSleep,
      capture,
      advance: () => Promise.resolve(true),
      onSlide: () => Promise.resolve(),
      onProgress,
      limit: 2,
      settleMs: 0,
    });

    expect(capture).toHaveBeenCalledTimes(2);
    expect(summary.total).toBe(5);
    expect(summary.captured).toBe(2);
    expect(summary.reachedEnd).toBe(false);
    expect(
      onProgress.mock.calls.every(([progress]) => progress.total === 2),
    ).toBe(true);
  });

  it("captures the whole deck when the requested limit exceeds it", async () => {
    document.body.innerHTML = `<div aria-setsize="3"></div>`;
    const summary = await runCapture({
      document,
      sleep: immediateSleep,
      capture: (index: number) => Promise.resolve(okResult(index)),
      advance: () => Promise.resolve(true),
      onSlide: () => Promise.resolve(),
      onProgress: () => undefined,
      limit: 10,
      settleMs: 0,
    });

    expect(summary.total).toBe(3);
    expect(summary.captured).toBe(3);
  });

  it("records a failed slide and continues", async () => {
    const capture = vi.fn((index: number) =>
      Promise.resolve(index === 2 ? failedResult : okResult(index)),
    );
    const summary = await runCapture({
      document,
      sleep: immediateSleep,
      capture,
      advance: () => Promise.resolve(true),
      onSlide: () => Promise.resolve(),
      onProgress: () => undefined,
      settleMs: 0,
    });

    expect(summary.captured).toBe(2);
    expect(summary.failed).toEqual([2]);
    expect(summary.reachedEnd).toBe(false);
  });

  it("stops when an unknown-size deck no longer advances", async () => {
    document.body.innerHTML = `<div class="punch-viewer-container"></div>`;
    const capture = vi.fn((index: number) => Promise.resolve(okResult(index)));

    const summary = await runCapture({
      document,
      sleep: immediateSleep,
      capture,
      advance: () => Promise.resolve(false),
      onSlide: () => Promise.resolve(),
      onProgress: () => undefined,
      maxSlides: 10,
      settleMs: 0,
      advanceAttempts: 2,
      advanceRetryMs: 0,
    });

    expect(summary.captured).toBe(1);
    expect(summary.reachedEnd).toBe(false);
  });

  it("flags an early stop when the expected total is known", async () => {
    document.body.innerHTML = `<div aria-setsize="5"></div>`;
    const summary = await runCapture({
      document,
      sleep: immediateSleep,
      capture: (index: number) => Promise.resolve(okResult(index)),
      advance: () => Promise.resolve(false),
      onSlide: () => Promise.resolve(),
      onProgress: () => undefined,
      settleMs: 0,
    });

    expect(summary.total).toBe(5);
    expect(summary.captured).toBe(1);
    expect(summary.reachedEnd).toBe(true);
  });

  it("reports a storage failure without losing earlier counts", async () => {
    const capture = vi.fn((index: number) => Promise.resolve(okResult(index)));
    const onSlide = vi.fn((slide: { index: number }) =>
      slide.index === 2
        ? Promise.reject(new Error("quota exceeded"))
        : Promise.resolve(),
    );

    const summary = await runCapture({
      document,
      sleep: immediateSleep,
      capture,
      advance: () => Promise.resolve(true),
      onSlide,
      onProgress: () => undefined,
      settleMs: 0,
    });

    expect(summary.captured).toBe(1);
    expect(summary.error).toContain("quota exceeded");
  });

  it("stops when cancelled", async () => {
    let calls = 0;
    const capture = vi.fn((index: number) => Promise.resolve(okResult(index)));

    const summary = await runCapture({
      document,
      sleep: immediateSleep,
      capture,
      advance: () => Promise.resolve(true),
      onSlide: () => Promise.resolve(),
      onProgress: () => undefined,
      isCancelled: () => {
        calls += 1;
        return calls > 1;
      },
      settleMs: 0,
    });

    expect(summary.cancelled).toBe(true);
    expect(summary.captured).toBe(1);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it("reports the traversed count when an unknown-size deck stops advancing", async () => {
    document.body.innerHTML = `<div class="punch-viewer-container"></div>`;
    const advance = vi.fn(() => Promise.resolve(false));

    const summary = await runCapture({
      document,
      sleep: immediateSleep,
      capture: (index: number) => Promise.resolve(okResult(index)),
      advance,
      onSlide: () => Promise.resolve(),
      onProgress: () => undefined,
      maxSlides: 5,
      settleMs: 0,
    });

    expect(summary.total).toBe(1);
    expect(summary.reachedEnd).toBe(false);
    expect(summary.captured).toBe(1);
  });

  it("reports the traversed count when an unknown-size deck advances", async () => {
    document.body.innerHTML = `<div class="punch-viewer-container"></div>`;
    let advances = 0;
    const advance = vi.fn(async () => {
      advances += 1;
      return advances <= 2;
    });

    const summary = await runCapture({
      document,
      sleep: immediateSleep,
      capture: (index: number) => Promise.resolve(okResult(index)),
      advance,
      onSlide: () => Promise.resolve(),
      onProgress: () => undefined,
      maxSlides: 5,
      settleMs: 0,
    });

    expect(summary.total).toBe(3);
    expect(summary.captured).toBe(3);
    expect(summary.reachedEnd).toBe(false);
  });
});
