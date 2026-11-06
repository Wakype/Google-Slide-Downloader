import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureSlide } from "../src/capture/capture-slide";

const XLINK = "http://www.w3.org/1999/xlink";

function setupSvg(): SVGSVGElement {
  document.body.innerHTML = `
    <div class="punch-viewer-svgpage-svgcontainer">
      <svg width="800" height="600"><image /></svg>
    </div>
  `;
  const svg = document.querySelector("svg") as SVGSVGElement;
  const image = svg.querySelector("image") as SVGImageElement;
  image.setAttributeNS(XLINK, "xlink:href", "https://example.com/photo.png");
  return svg;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("captureSlide", () => {
  it("inlines remote images and returns the rasterized PNG", async () => {
    setupSvg();
    const fetchImageAsDataUrl = vi
      .fn<(href: string) => Promise<string>>()
      .mockResolvedValue("data:image/png;base64,AAAA");
    const rasterize = vi.fn(async (svg: SVGSVGElement) => {
      const image = svg.querySelector("image")!;
      expect(image.getAttribute("href")).toBe("data:image/png;base64,AAAA");
      expect(image.getAttributeNS(XLINK, "href")).toBeNull();
      return {
        dataUrl: "data:image/png;base64,OUT",
        width: 800,
        height: 600,
      };
    });

    const result = await captureSlide(document, {
      fetchImageAsDataUrl,
      rasterize,
    });

    expect(fetchImageAsDataUrl).toHaveBeenCalledWith(
      "https://example.com/photo.png",
    );
    expect(rasterize).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      dataUrl: "data:image/png;base64,OUT",
      width: 800,
      height: 600,
      reason: null,
      warning: null,
    });
  });

  it("warns when an embedded image cannot be inlined", async () => {
    setupSvg();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await captureSlide(document, {
      fetchImageAsDataUrl: vi
        .fn()
        .mockRejectedValue(new Error("blocked by CORS")),
      rasterize: vi.fn(async () => ({
        dataUrl: "data:image/png;base64,OUT",
        width: 800,
        height: 600,
      })),
    });

    expect(result.ok).toBe(true);
    expect(result.warning).toContain("1 embedded image");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns a failure when no SVG is present", async () => {
    document.body.innerHTML = `<div class="punch-viewer-container"></div>`;
    const result = await captureSlide(document, {
      fetchImageAsDataUrl: vi.fn(),
      rasterize: vi.fn(),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("svg-not-found");
  });

  it("returns a failure when rasterization throws", async () => {
    setupSvg();
    const result = await captureSlide(document, {
      fetchImageAsDataUrl: vi.fn(),
      rasterize: vi.fn().mockRejectedValue(new Error("tainted canvas")),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("tainted canvas");
  });
});
