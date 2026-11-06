export interface StartCaptureMessage {
  type: "START_CAPTURE";
}

export interface RunCaptureMessage {
  type: "RUN_CAPTURE";
  sessionId: string;
  sourceUrl: string;
  title: string;
}

export interface PingMessage {
  type: "PING";
}

export type PingResponse =
  | { ok: true; running: boolean }
  | { ok: false; error: string };

export interface CaptureSlideMessage {
  type: "CAPTURE_SLIDE";
  sessionId: string;
  index: number;
  total: number;
  dataUrl: string;
  width: number;
  height: number;
  warning: string | null;
}

export interface CaptureProgressMessage {
  type: "CAPTURE_PROGRESS";
  sessionId: string;
  current: number;
  total: number;
  failed: number[];
}

export interface CaptureCompleteMessage {
  type: "CAPTURE_COMPLETE";
  sessionId: string;
  total: number;
  captured: number;
  failed: number[];
  reachedEnd: boolean;
}

export interface CaptureErrorMessage {
  type: "CAPTURE_ERROR";
  sessionId: string;
  total: number;
  captured: number;
  failed: number[];
  error: string;
}

export type RuntimeMessage =
  | StartCaptureMessage
  | RunCaptureMessage
  | PingMessage
  | CaptureSlideMessage
  | CaptureProgressMessage
  | CaptureCompleteMessage
  | CaptureErrorMessage;

export type StartCaptureResponse =
  | { ok: true; sessionId: string }
  | { ok: false; error: string };

export type Ack = { ok: true } | { ok: false; error: string };

export function isAck(value: unknown): value is Ack {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    typeof (value as { ok: unknown }).ok === "boolean"
  );
}
