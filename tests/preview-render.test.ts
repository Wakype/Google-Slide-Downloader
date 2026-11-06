import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDemoCapture } from "../src/preview/demo";
import {
  buildPreviewModel,
  createMissingModel,
  type PreviewModel,
} from "../src/preview/model";
import { renderPreview } from "../src/preview/render";

function buttonByText(root: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`button not found: ${text}`);
  }
  return button;
}

function model(overrides: Partial<PreviewModel> = {}): PreviewModel {
  return {
    sessionId: "session-1",
    title: "My deck",
    sourceHost: "docs.google.com",
    capturedAt: "Nov 6, 2026, 10:00 AM",
    total: 2,
    captured: 2,
    failed: [],
    status: "complete",
    error: null,
    isEmpty: false,
    isDemo: false,
    missing: false,
    downloadFolder: "Slides/My deck",
    slides: [
      {
        index: 1,
        filename: "Slide_001.png",
        downloadUrl: "blob:one",
        width: 1920,
        height: 1080,
      },
      {
        index: 2,
        filename: "Slide_002.png",
        downloadUrl: "blob:two",
        width: 1920,
        height: 1080,
      },
    ],
    ...overrides,
  };
}

function handlers() {
  return {
    onDownloadAll: vi.fn(),
    onDownloadAllAndMerge: vi.fn(),
    onDownloadSlide: vi.fn(),
    onClose: vi.fn(),
  };
}

beforeEach(() => {
  document.body.innerHTML = `<div id="app"></div>`;
});

describe("renderPreview", () => {
  it("renders the deck, actions, and one card per slide", () => {
    const root = document.getElementById("app") as HTMLElement;
    renderPreview(root, model(), handlers());

    expect(root.querySelector("h1")?.textContent).toBe("My deck");
    expect(buttonByText(root, "Download all")).toBeTruthy();
    expect(buttonByText(root, "Download all + Merge PDF")).toBeTruthy();
    expect(root.querySelectorAll("article.slide-card")).toHaveLength(2);
    expect(
      root.querySelector('button[aria-label="Download Slide 2"]'),
    ).toBeTruthy();
  });

  it("wires the bulk actions and per-slide downloads", () => {
    const root = document.getElementById("app") as HTMLElement;
    const callbacks = handlers();
    renderPreview(root, model(), callbacks);

    buttonByText(root, "Download all").click();
    buttonByText(root, "Download all + Merge PDF").click();
    root
      .querySelector<HTMLButtonElement>('button[aria-label="Download Slide 1"]')
      ?.click();

    expect(callbacks.onDownloadAll).toHaveBeenCalledTimes(1);
    expect(callbacks.onDownloadAllAndMerge).toHaveBeenCalledTimes(1);
    expect(callbacks.onDownloadSlide).toHaveBeenCalledWith(
      expect.objectContaining({ index: 1, filename: "Slide_001.png" }),
    );
  });

  it("shows failed slide numbers in a partial capture", () => {
    const root = document.getElementById("app") as HTMLElement;
    renderPreview(
      root,
      model({ failed: [2, 4], captured: 1, total: 4 }),
      handlers(),
    );

    expect(root.textContent).toContain("Slides 2, 4");
  });

  it("shows the capture error above successful slides", () => {
    const root = document.getElementById("app") as HTMLElement;
    renderPreview(
      root,
      model({ status: "error", error: "quota exceeded" }),
      handlers(),
    );

    expect(root.textContent).toContain("quota exceeded");
    expect(root.querySelectorAll("article.slide-card")).toHaveLength(2);
  });

  it("renders an empty state with one clear action", () => {
    const root = document.getElementById("app") as HTMLElement;
    const callbacks = handlers();
    renderPreview(
      root,
      model({ slides: [], isEmpty: true, captured: 0 }),
      callbacks,
    );

    expect(root.textContent).toContain("No slides were captured");
    const close = buttonByText(root, "Close tab");
    close.click();
    expect(callbacks.onClose).toHaveBeenCalledTimes(1);
    expect(root.querySelectorAll("article.slide-card")).toHaveLength(0);
  });

  it("renders only the empty state for a missing capture", () => {
    const root = document.getElementById("app") as HTMLElement;
    renderPreview(root, createMissingModel(), handlers());

    expect(root.querySelector(".banner")).toBeNull();
    expect(root.textContent).toContain("Capture not found");
  });

  it("renders six cards for the demo capture", () => {
    const root = document.getElementById("app") as HTMLElement;
    const demo = createDemoCapture();
    const urls = new Map(
      demo.slides.map((slide) => [slide.id, `blob:demo-${slide.index}`]),
    );
    renderPreview(
      root,
      buildPreviewModel(demo.session, demo.slides, urls, true),
      handlers(),
    );

    expect(root.querySelectorAll("article.slide-card")).toHaveLength(6);
    expect(root.querySelector("h1")?.textContent).toContain("Demo");
  });
});
