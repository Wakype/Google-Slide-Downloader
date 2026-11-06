import { PDF24_MERGE_URL, TIMING } from "../shared/constants";
import type { PreviewSlide } from "./model";

export interface DownloadDeps {
  download(options: chrome.downloads.DownloadOptions): Promise<number>;
  sleep(ms: number): Promise<void>;
  openTab(url: string): Promise<unknown>;
}

export async function downloadSlide(
  slide: PreviewSlide,
  folder: string,
  deps: DownloadDeps,
): Promise<void> {
  if (!slide.downloadUrl) {
    throw new Error(`Slide ${slide.index} has no download URL.`);
  }

  await deps.download({
    url: slide.downloadUrl,
    filename: `${folder}/${slide.filename}`,
    conflictAction: "uniquify",
    saveAs: false,
  });
}

export async function downloadAll(
  slides: PreviewSlide[],
  folder: string,
  deps: DownloadDeps,
): Promise<void> {
  for (const slide of slides) {
    await downloadSlide(slide, folder, deps);
    await deps.sleep(TIMING.downloadGapMs);
  }
}

export async function downloadAllAndMerge(
  slides: PreviewSlide[],
  folder: string,
  deps: DownloadDeps,
): Promise<void> {
  await downloadAll(slides, folder, deps);
  await deps.sleep(TIMING.mergeOpenDelayMs);
  await deps.openTab(PDF24_MERGE_URL);
}
