import type { CaptureSession, SlideRecord } from "../shared/types";
import { formatSlideFilename } from "../shared/utils";

interface Palette {
  background: string;
  foreground: string;
  accent: string;
}

const PALETTES: Palette[] = [
  { background: "#0f172a", foreground: "#f8fafc", accent: "#38bdf8" },
  { background: "#0b3b36", foreground: "#ecfdf5", accent: "#34d399" },
  { background: "#3b1d1d", foreground: "#fef2f2", accent: "#fb7185" },
  { background: "#3b2a0b", foreground: "#fffbeb", accent: "#fbbf24" },
  { background: "#1e1b4b", foreground: "#eef2ff", accent: "#818cf8" },
  { background: "#1f2937", foreground: "#f9fafb", accent: "#a7f3d0" },
];

function demoSlideSvg(
  index: number,
  palette: Palette,
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="1920" height="1080" fill="${palette.background}"/>
  <rect x="120" y="120" width="1680" height="840" rx="36" fill="none" stroke="${palette.accent}" stroke-opacity="0.35" stroke-width="4"/>
  <text x="180" y="430" fill="${palette.foreground}" font-family="Segoe UI, Arial, sans-serif" font-size="124" font-weight="700">Slide ${index}</text>
  <text x="180" y="550" fill="${palette.accent}" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="500">Demo preview</text>
  <rect x="180" y="650" width="360" height="14" rx="7" fill="${palette.accent}"/>
</svg>`;
}

export function createDemoCapture(now: number = Date.now()): {
  session: CaptureSession;
  slides: SlideRecord[];
} {
  const session: CaptureSession = {
    id: "demo-session",
    tabId: 0,
    sourceUrl: "https://docs.google.com/presentation/d/e/demo/pub",
    title: "Demo deck — product launch",
    createdAt: now,
    total: 6,
    limit: null,
    captured: 6,
    failed: [],
    status: "complete",
    error: null,
    reachedEnd: false,
  };

  const slides = Array.from({ length: 6 }, (_, offset) => {
    const index = offset + 1;
    const palette = PALETTES[offset % PALETTES.length] ?? PALETTES[0]!;
    const blob = new Blob([demoSlideSvg(index, palette)], {
      type: "image/svg+xml",
    });
    return {
      id: `demo-session:${index}`,
      sessionId: "demo-session",
      index,
      filename: formatSlideFilename(index),
      blob,
      width: 1920,
      height: 1080,
      warning: null,
    } satisfies SlideRecord;
  });

  return { session, slides };
}
