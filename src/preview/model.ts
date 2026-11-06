import type {
  CaptureSession,
  CaptureStatus,
  SlideRecord,
} from "../shared/types";
import { buildDeckFolder, formatCapturedAt } from "../shared/utils";

export interface PreviewSlide {
  index: number;
  filename: string;
  downloadUrl: string;
  width: number;
  height: number;
  warning: string | null;
}

export interface PreviewModel {
  sessionId: string;
  title: string;
  sourceHost: string;
  capturedAt: string;
  total: number;
  captured: number;
  failed: number[];
  status: CaptureStatus;
  error: string | null;
  isEmpty: boolean;
  isDemo: boolean;
  missing: boolean;
  reachedEnd: boolean;
  degradedCount: number;
  downloadFolder: string;
  slides: PreviewSlide[];
}

export function buildPreviewModel(
  session: CaptureSession,
  slides: SlideRecord[],
  objectUrls: ReadonlyMap<string, string>,
  isDemo = false,
): PreviewModel {
  let sourceHost = "";
  try {
    sourceHost = new URL(session.sourceUrl).hostname;
  } catch {
    sourceHost = "";
  }

  const traversed = slides.length + session.failed.length;

  return {
    sessionId: session.id,
    title: session.title,
    sourceHost,
    capturedAt: formatCapturedAt(session.createdAt),
    total:
      session.total !== null && session.total > 0 ? session.total : traversed,
    captured: slides.length,
    failed: session.failed,
    status: session.status,
    error: session.error,
    isEmpty: slides.length === 0,
    isDemo,
    missing: false,
    reachedEnd: session.reachedEnd,
    degradedCount: slides.filter((slide) => slide.warning).length,
    downloadFolder: buildDeckFolder(session.title),
    slides: slides.map((slide) => ({
      index: slide.index,
      filename: slide.filename,
      downloadUrl: objectUrls.get(slide.id) ?? "",
      width: slide.width,
      height: slide.height,
      warning: slide.warning ?? null,
    })),
  };
}

export function createMissingModel(): PreviewModel {
  return {
    sessionId: "",
    title: "Capture not found",
    sourceHost: "",
    capturedAt: "",
    total: 0,
    captured: 0,
    failed: [],
    status: "error",
    error:
      "No capture was found for this link. Return to the presentation tab and run Start Capture again.",
    isEmpty: true,
    isDemo: false,
    missing: true,
    reachedEnd: false,
    degradedCount: 0,
    downloadFolder: "Slides",
    slides: [],
  };
}
