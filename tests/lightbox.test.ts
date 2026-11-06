import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLightbox } from "../src/preview/lightbox";
import type { PreviewModel, PreviewSlide } from "../src/preview/model";

function slide(index: number): PreviewSlide {
  return {
    index,
    filename: `slide_00${index}.png`,
    downloadUrl: `blob:${["one", "two", "three"][index - 1]}`,
    width: 1920,
    height: 1080,
    warning: null,
  };
}

function model(): PreviewModel {
  return {
    sessionId: "session-1",
    title: "My deck",
    sourceHost: "docs.google.com",
    capturedAt: "Nov 6, 2026, 10:00 AM",
    total: 3,
    totalKnown: true,
    captured: 3,
    failed: [],
    status: "complete",
    error: null,
    isEmpty: false,
    isDemo: false,
    missing: false,
    reachedEnd: false,
    limit: null,
    degradedCount: 0,
    slides: [slide(1), slide(2), slide(3)],
  };
}

function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

function imageSrc(): string | null {
  return (
    document
      .querySelector<HTMLImageElement>(".lightbox-image")
      ?.getAttribute("src") ?? null
  );
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.body.classList.remove("has-lightbox");
});

describe("lightbox", () => {
  it("opens the selected slide with its filename and counter", () => {
    const lightbox = createLightbox(model(), { onDownload: vi.fn() });

    lightbox.open(1);

    expect(lightbox.isOpen()).toBe(true);
    expect(dialog()?.getAttribute("aria-label")).toBe("Slide 2 of 3");
    expect(imageSrc()).toBe("blob:two");
    expect(document.querySelector(".lightbox-filename")?.textContent).toBe(
      "slide_002.png",
    );
    expect(document.querySelector(".lightbox-counter")?.textContent).toBe(
      "2 / 3",
    );
    expect(document.body.classList.contains("has-lightbox")).toBe(true);
  });

  it("moves to the next and previous slides, wrapping at the ends", () => {
    const lightbox = createLightbox(model(), { onDownload: vi.fn() });
    lightbox.open(0);

    lightbox.next();
    expect(imageSrc()).toBe("blob:two");

    lightbox.next();
    expect(imageSrc()).toBe("blob:three");

    lightbox.next();
    expect(imageSrc()).toBe("blob:one");

    lightbox.previous();
    expect(imageSrc()).toBe("blob:three");
  });

  it("navigates with the arrow keys", () => {
    const lightbox = createLightbox(model(), { onDownload: vi.fn() });
    lightbox.open(0);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(lightbox.currentIndex()).toBe(1);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
    expect(lightbox.currentIndex()).toBe(0);
  });

  it("keeps focus on the next/previous control after navigation", () => {
    const lightbox = createLightbox(model(), { onDownload: vi.fn() });
    lightbox.open(0);

    lightbox.next();
    expect(document.activeElement?.classList.contains("lightbox-next")).toBe(
      true,
    );

    lightbox.previous();
    expect(document.activeElement?.classList.contains("lightbox-prev")).toBe(
      true,
    );
  });

  it("traps Tab focus inside the dialog", () => {
    const lightbox = createLightbox(model(), { onDownload: vi.fn() });
    lightbox.open(0);

    const download =
      document.querySelector<HTMLButtonElement>(".lightbox-download");
    download?.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    );
    expect(document.activeElement?.classList.contains("lightbox-prev")).toBe(
      true,
    );

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(
      document.activeElement?.classList.contains("lightbox-download"),
    ).toBe(true);
  });

  it("does not open with no slides", () => {
    const lightbox = createLightbox(
      { ...model(), slides: [] },
      { onDownload: vi.fn() },
    );

    lightbox.open(0);

    expect(lightbox.isOpen()).toBe(false);
    expect(dialog()).toBeNull();
  });

  it("downloads the currently visible slide", () => {
    const onDownload = vi.fn();
    const lightbox = createLightbox(model(), { onDownload });
    lightbox.open(2);

    document
      .querySelector<HTMLButtonElement>(".lightbox-download")
      ?.click();

    expect(onDownload).toHaveBeenCalledWith(
      expect.objectContaining({ index: 3, filename: "slide_003.png" }),
    );
  });

  it("closes with Escape and restores the page state", () => {
    const onClose = vi.fn();
    const lightbox = createLightbox(model(), { onDownload: vi.fn(), onClose });
    lightbox.open(1);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(lightbox.isOpen()).toBe(false);
    expect(dialog()).toBeNull();
    expect(document.body.classList.contains("has-lightbox")).toBe(false);
    expect(onClose).toHaveBeenCalledWith(1);
  });

  it("closes from the close button", () => {
    const lightbox = createLightbox(model(), { onDownload: vi.fn() });
    lightbox.open(0);

    document
      .querySelector<HTMLButtonElement>(".lightbox-close")
      ?.click();

    expect(dialog()).toBeNull();
  });
});
