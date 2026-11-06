export const DB_NAME = "slides-capture";
export const DB_VERSION = 1;
export const SESSION_STORE = "sessions";
export const SLIDE_STORE = "slides";
export const SLIDE_SESSION_INDEX = "sessionId";

export const MAX_SLIDES = 500;

export const TIMING = {
  advanceCheckMs: 600,
  advanceRetryMs: 500,
  advanceAttempts: 3,
  settleMs: 800,
  downloadGapMs: 120,
  mergeOpenDelayMs: 800,
} as const;

export const PDF24_MERGE_URL = "https://tools.pdf24.org/en/merge-pdf";

export const REPORT_ISSUE_URL =
  "https://github.com/Wakype/Google-Slide-Downloader/issues/new?template=bug_report.yml";
