import { PDF24_MERGE_URL, TIMING } from "../shared/constants";
import type { PreviewSlide } from "./model";

export interface DownloadDeps {
  save(url: string, filename: string): void;
  sleep(ms: number): Promise<void>;
  openTab(url: string): void;
}

export async function downloadSlide(
  slide: PreviewSlide,
  deps: DownloadDeps,
): Promise<void> {
  if (!slide.downloadUrl) {
    throw new Error(`Slide ${slide.index} has no download URL.`);
  }
  deps.save(slide.downloadUrl, slide.filename);
}

export async function downloadAll(
  slides: PreviewSlide[],
  deps: DownloadDeps,
): Promise<void> {
  for (const slide of slides) {
    await downloadSlide(slide, deps);
  }
  await deps.sleep(TIMING.downloadGapMs);
}

export async function downloadAllAndMerge(
  slides: PreviewSlide[],
  deps: DownloadDeps,
): Promise<void> {
  // Open within the button's user gesture so the browser does not block it.
  deps.openTab(PDF24_MERGE_URL);
  await downloadAll(slides, deps);
}
