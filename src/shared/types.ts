export type CaptureStatus = "capturing" | "complete" | "error";

export interface CaptureSession {
  id: string;
  tabId: number;
  sourceUrl: string;
  title: string;
  createdAt: number;
  total: number | null;
  captured: number;
  failed: number[];
  status: CaptureStatus;
  error: string | null;
  reachedEnd: boolean;
}

export interface SlideRecord {
  id: string;
  sessionId: string;
  index: number;
  filename: string;
  blob: Blob;
  width: number;
  height: number;
}

export interface CaptureResult {
  ok: boolean;
  dataUrl: string | null;
  width: number;
  height: number;
  reason: string | null;
}

export interface CapturedSlide {
  index: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface CaptureProgress {
  current: number;
  total: number;
  failed: number[];
}

export interface CaptureSummary {
  total: number;
  captured: number;
  failed: number[];
  reachedEnd: boolean;
  cancelled: boolean;
  error: string | null;
}
