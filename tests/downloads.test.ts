import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadAll,
  downloadAllAndMerge,
  downloadSlide,
  type DownloadDeps,
} from "../src/preview/downloads";
import { PDF24_MERGE_URL, TIMING } from "../src/shared/constants";
import type { PreviewSlide } from "../src/preview/model";

const slides: PreviewSlide[] = [
  {
    index: 1,
    filename: "Slide_001.png",
    downloadUrl: "blob:one",
    width: 1920,
    height: 1080,
    warning: null,
  },
  {
    index: 2,
    filename: "Slide_002.png",
    downloadUrl: "blob:two",
    width: 1920,
    height: 1080,
    warning: null,
  },
];

let calls: chrome.downloads.DownloadOptions[];
let deps: DownloadDeps;

beforeEach(() => {
  calls = [];
  deps = {
    download: vi.fn(async (options) => {
      calls.push(options);
      return 1;
    }),
    sleep: vi.fn(async () => undefined),
    openTab: vi.fn(async () => undefined),
  };
});

describe("preview downloads", () => {
  it("downloads one slide to the deck folder", async () => {
    await downloadSlide(slides[0]!, "Slides/My deck", deps);

    expect(calls).toEqual([
      {
        url: "blob:one",
        filename: "Slides/My deck/Slide_001.png",
        conflictAction: "uniquify",
        saveAs: false,
      },
    ]);
  });

  it("downloads all slides in index order with a gap", async () => {
    await downloadAll(slides, "Slides/My deck", deps);

    expect(calls.map((call) => call.filename)).toEqual([
      "Slides/My deck/Slide_001.png",
      "Slides/My deck/Slide_002.png",
    ]);
    expect(deps.sleep).toHaveBeenCalledWith(TIMING.downloadGapMs);
  });

  it("opens PDF24 after all downloads have started", async () => {
    await downloadAllAndMerge(slides, "Slides/My deck", deps);

    expect(calls).toHaveLength(2);
    expect(deps.openTab).toHaveBeenCalledWith(PDF24_MERGE_URL);
    expect(deps.sleep).toHaveBeenCalledWith(TIMING.mergeOpenDelayMs);
  });
});
