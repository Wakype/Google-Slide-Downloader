import { MAX_SLIDES, TIMING } from "../shared/constants";
import type {
  CaptureProgress,
  CaptureResult,
  CaptureSummary,
  CapturedSlide,
} from "../shared/types";
import { parseTotalSlides, toErrorMessage } from "../shared/utils";

export interface RunCaptureOptions {
  document: Document;
  sleep: (ms: number) => Promise<void>;
  capture: (index: number) => Promise<CaptureResult>;
  advance: () => Promise<boolean>;
  onSlide: (slide: CapturedSlide) => Promise<void>;
  onProgress: (progress: CaptureProgress) => Promise<void> | void;
  isCancelled?: () => boolean;
  maxSlides?: number;
  limit?: number | null;
  settleMs?: number;
  advanceAttempts?: number;
  advanceRetryMs?: number;
}

export async function runCapture(
  options: RunCaptureOptions,
): Promise<CaptureSummary> {
  const maxSlides = Math.min(options.maxSlides ?? MAX_SLIDES, MAX_SLIDES);
  const detectedTotal = parseTotalSlides(options.document);
  const requestedLimit =
    options.limit !== null && options.limit !== undefined
      ? Math.min(Math.max(1, Math.floor(options.limit)), maxSlides)
      : maxSlides;
  const loopLimit = Math.min(detectedTotal ?? requestedLimit, requestedLimit);
  const progressTotal =
    detectedTotal !== null
      ? Math.min(detectedTotal, requestedLimit)
      : options.limit !== null && options.limit !== undefined
        ? requestedLimit
        : 0;
  const settleMs = options.settleMs ?? TIMING.settleMs;
  const advanceAttempts = options.advanceAttempts ?? TIMING.advanceAttempts;
  const advanceRetryMs = options.advanceRetryMs ?? TIMING.advanceRetryMs;

  const failed: number[] = [];
  let captured = 0;
  let reachedEnd = false;
  let cancelled = false;
  let error: string | null = null;

  for (let index = 1; index <= loopLimit; index += 1) {
    if (options.isCancelled?.()) {
      cancelled = true;
      break;
    }

    await options.onProgress({
      current: index,
      total: progressTotal,
      failed: [...failed],
    });

    let result: CaptureResult;
    try {
      result = await options.capture(index);
    } catch (captureError) {
      result = {
        ok: false,
        dataUrl: null,
        width: 0,
        height: 0,
        reason: toErrorMessage(captureError),
        warning: null,
      };
    }

    if (result.ok && result.dataUrl) {
      try {
        await options.onSlide({
          index,
          dataUrl: result.dataUrl,
          width: result.width,
          height: result.height,
          warning: result.warning,
        });
        captured += 1;
      } catch (storageError) {
        error = `Could not store slide ${index}: ${toErrorMessage(storageError)}`;
        break;
      }
    } else {
      failed.push(index);
      console.warn(
        `[Slides Capture] Slide ${index} failed: ${result.reason ?? "unknown"}`,
      );
    }

    await options.onProgress({
      current: index,
      total: progressTotal,
      failed: [...failed],
    });

    if (index >= loopLimit) break;

    let moved = false;
    for (let attempt = 1; attempt <= advanceAttempts; attempt += 1) {
      try {
        moved = await options.advance();
      } catch {
        moved = false;
      }
      if (moved) break;
      if (attempt < advanceAttempts) await options.sleep(advanceRetryMs);
    }

    if (!moved) {
      reachedEnd = true;
      break;
    }

    await options.sleep(settleMs);
  }

  const total = detectedTotal ?? captured + failed.length;

  return {
    total,
    totalKnown: detectedTotal !== null,
    captured,
    failed,
    reachedEnd,
    cancelled,
    error,
  };
}
