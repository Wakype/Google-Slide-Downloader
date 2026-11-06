import type {
  CaptureSession,
  CaptureStatus,
  SlideRecord,
} from "../shared/types";
import { formatCapturedAt, sanitizeFilenamePart } from "../shared/utils";

export interface PreviewSlide {
  index: number;
  filename: string;
  downloadUrl: string;
  width: number;
  height: number;
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

  return {
    sessionId: session.id,
    title: session.title,
    sourceHost,
    capturedAt: formatCapturedAt(session.createdAt),
    total: session.total ?? slides.length,
    captured: slides.length,
    failed: session.failed,
    status: session.status,
    error: session.error,
    isEmpty: slides.length === 0,
    isDemo,
    missing: false,
    downloadFolder: `Slides/${sanitizeFilenamePart(session.title)}`,
    slides: slides.map((slide) => ({
      index: slide.index,
      filename: slide.filename,
      downloadUrl: objectUrls.get(slide.id) ?? "",
      width: slide.width,
      height: slide.height,
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
    downloadFolder: "Slides",
    slides: [],
  };
}
