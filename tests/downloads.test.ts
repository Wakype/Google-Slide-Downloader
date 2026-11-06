import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadAll,
  downloadAllAndMerge,
  downloadSlide,
  saveWithAnchor,
  type DownloadDeps,
} from "../src/preview/downloads";
import { PDF24_MERGE_URL, TIMING } from "../src/shared/constants";
import type { PreviewSlide } from "../src/preview/model";

const slides: PreviewSlide[] = [
  {
    index: 1,
    filename: "slide_001.png",
    downloadUrl: "blob:one",
    width: 1920,
    height: 1080,
    warning: null,
  },
  {
    index: 2,
    filename: "slide_002.png",
    downloadUrl: "blob:two",
    width: 1920,
    height: 1080,
    warning: null,
  },
];

let saved: Array<{ url: string; filename: string }>;
let deps: DownloadDeps;

beforeEach(() => {
  saved = [];
  deps = {
    save: (url, filename) => {
      saved.push({ url, filename });
    },
    sleep: vi.fn(async () => undefined),
    openTab: vi.fn(),
  };
});

describe("preview downloads", () => {
  it("creates an anchor with the exact href and download filename", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.getAttribute("href")).toBe("blob:one");
        expect(this.download).toBe("slide_001.png");
      });

    saveWithAnchor(document, "blob:one", "slide_001.png");

    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll("a")).toHaveLength(0);
    click.mockRestore();
  });

  it("saves one slide with its filename", async () => {
    await downloadSlide(slides[0]!, deps);

    expect(saved).toEqual([
      { url: "blob:one", filename: "slide_001.png" },
    ]);
  });

  it("saves all slides in index order with a gap", async () => {
    await downloadAll(slides, deps);

    expect(saved.map((entry) => entry.filename)).toEqual([
      "slide_001.png",
      "slide_002.png",
    ]);
    expect(deps.sleep).toHaveBeenCalledWith(TIMING.downloadGapMs);
  });

  it("opens PDF24 before starting all downloads", async () => {
    const order: string[] = [];
    deps.save = (url, filename) => {
      order.push(filename);
      saved.push({ url, filename });
    };
    deps.openTab = vi.fn((url: string) => {
      order.push(url);
    });

    await downloadAllAndMerge(slides, deps);

    expect(order[0]).toBe(PDF24_MERGE_URL);
    expect(saved).toHaveLength(2);
    expect(deps.openTab).toHaveBeenCalledWith(PDF24_MERGE_URL);
  });
});
