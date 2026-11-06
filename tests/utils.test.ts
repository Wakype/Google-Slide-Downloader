import { beforeEach, describe, expect, it } from "vitest";
import {
  formatSlideFilename,
  getSlideSignature,
  isSlidesPresentationUrl,
  parseTotalSlides,
} from "../src/shared/utils";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("isSlidesPresentationUrl", () => {
  it("accepts published, embedded, and present views", () => {
    expect(
      isSlidesPresentationUrl(
        "https://docs.google.com/presentation/d/e/2PACX-abc/pub?start=false",
      ),
    ).toBe(true);
    expect(
      isSlidesPresentationUrl(
        "https://docs.google.com/presentation/d/e/2PACX-abc/pubembed?start=false",
      ),
    ).toBe(true);
    expect(
      isSlidesPresentationUrl(
        "https://docs.google.com/presentation/d/abc123/present",
      ),
    ).toBe(true);
    expect(
      isSlidesPresentationUrl(
        "https://docs.google.com/presentation/d/e/2PACX-abc/embed",
      ),
    ).toBe(true);
    expect(
      isSlidesPresentationUrl(
        "https://docs.google.com/presentation/d/e/2PACX-abc/preview",
      ),
    ).toBe(true);
  });

  it("rejects editor pages, other hosts, and malformed input", () => {
    expect(
      isSlidesPresentationUrl("https://docs.google.com/presentation/d/abc123/edit"),
    ).toBe(false);
    expect(
      isSlidesPresentationUrl("https://example.com/presentation/d/e/abc/pub"),
    ).toBe(false);
    expect(isSlidesPresentationUrl(undefined)).toBe(false);
    expect(isSlidesPresentationUrl("not a url")).toBe(false);
  });
});

describe("formatSlideFilename", () => {
  it("pads the slide number to three digits", () => {
    expect(formatSlideFilename(1)).toBe("slide_001.png");
    expect(formatSlideFilename(42)).toBe("slide_042.png");
    expect(formatSlideFilename(1234)).toBe("slide_1234.png");
  });
});

describe("parseTotalSlides", () => {
  it("reads aria-setsize first", () => {
    document.body.innerHTML = `<div aria-setsize="12"></div>`;
    expect(parseTotalSlides(document)).toBe(12);
  });

  it("falls back to the viewer caption", () => {
    document.body.innerHTML = `<div class="docs-material-menu-button-flat-default-caption">3 of 20</div>`;
    expect(parseTotalSlides(document)).toBe(20);
  });

  it("returns null when the count is unavailable", () => {
    document.body.innerHTML = `<div class="punch-viewer-container"></div>`;
    expect(parseTotalSlides(document)).toBeNull();
  });
});

describe("getSlideSignature", () => {
  it("changes when the caption or SVG content changes", () => {
    document.body.innerHTML = `
      <div class="docs-material-menu-button-flat-default-caption" aria-posinset="1">1 of 3</div>
      <div class="punch-viewer-svgpage-svgcontainer"><svg><text>first slide</text></svg></div>
    `;
    const first = getSlideSignature(document);

    document.querySelector("svg")!.textContent = "second slide";
    const second = getSlideSignature(document);

    expect(second).not.toBe(first);
  });

  it("returns a stable signature when nothing changed", () => {
    document.body.innerHTML = `
      <div class="docs-material-menu-button-flat-default-caption" aria-posinset="1">1 of 3</div>
      <div class="punch-viewer-svgpage-svgcontainer"><svg><text>slide</text></svg></div>
    `;
    expect(getSlideSignature(document)).toBe(getSlideSignature(document));
  });
});

