import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureSlide,
  getSvgDimensions,
} from "../src/capture/capture-slide";

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

describe("getSvgDimensions", () => {
  it("falls back to the viewBox when width and height are relative", () => {
    const svg = {
      viewBox: { baseVal: { width: 960, height: 540 } },
      width: {
        baseVal: {
          get value(): number {
            throw new Error("Could not resolve relative length.");
          },
        },
      },
      height: {
        baseVal: {
          get value(): number {
            throw new Error("Could not resolve relative length.");
          },
        },
      },
    } as unknown as SVGSVGElement;

    expect(getSvgDimensions(svg)).toEqual({ width: 960, height: 540 });
  });

  it("prefers explicit width and height", () => {
    const svg = {
      viewBox: { baseVal: { width: 400, height: 300 } },
      width: { baseVal: { value: 800 } },
      height: { baseVal: { value: 600 } },
    } as unknown as SVGSVGElement;
    expect(getSvgDimensions(svg)).toEqual({ width: 800, height: 600 });
  });
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
    const rasterize = vi.fn(async (svg: SVGSVGElement) => {
      expect(svg.querySelector("image")).toBeNull();
      return {
        dataUrl: "data:image/png;base64,OUT",
        width: 800,
        height: 600,
      };
    });
    const result = await captureSlide(document, {
      fetchImageAsDataUrl: vi
        .fn()
        .mockRejectedValue(new Error("blocked by CORS")),
      rasterize,
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
