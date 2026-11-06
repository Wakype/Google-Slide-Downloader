import type { CaptureResult } from "../shared/types";
import { toErrorMessage } from "../shared/utils";
import { findSvg } from "./selectors";

const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";

export interface CaptureSlideDeps {
  fetchImageAsDataUrl: (href: string) => Promise<string>;
  rasterize: (
    svg: SVGSVGElement,
  ) => Promise<{ dataUrl: string; width: number; height: number }>;
}

function failure(reason: string): CaptureResult {
  return {
    ok: false,
    dataUrl: null,
    width: 0,
    height: 0,
    reason,
    warning: null,
  };
}

async function inlineImages(
  clone: SVGSVGElement,
  fetchImageAsDataUrl: (href: string) => Promise<string>,
): Promise<string[]> {
  const images = Array.from(clone.querySelectorAll("image"));
  const failed: string[] = [];

  await Promise.all(
    images.map(async (image) => {
      const href =
        image.getAttribute("href") ??
        image.getAttributeNS(XLINK_NAMESPACE, "href") ??
        image.getAttribute("xlink:href");

      if (!href || href.startsWith("data:")) return;

      try {
        const dataUrl = await fetchImageAsDataUrl(href);
        image.removeAttribute("href");
        image.removeAttributeNS(XLINK_NAMESPACE, "href");
        image.removeAttribute("xlink:href");
        image.setAttribute("href", dataUrl);
      } catch (error) {
        failed.push(href);
        image.remove();
        console.warn("Sub-image asset skipped:", href, error);
      }
    }),
  );

  return failed;
}

export async function captureSlide(
  doc: Document,
  deps: CaptureSlideDeps,
): Promise<CaptureResult> {
  const svg = findSvg(doc);
  if (!svg) return failure("svg-not-found");

  const clone = svg.cloneNode(true) as SVGSVGElement;
  const failedAssets = await inlineImages(clone, deps.fetchImageAsDataUrl);

  try {
    const raster = await deps.rasterize(clone);
    return {
      ok: true,
      dataUrl: raster.dataUrl,
      width: raster.width,
      height: raster.height,
      reason: null,
      warning:
        failedAssets.length > 0
          ? `${failedAssets.length} embedded image(s) could not be inlined.`
          : null,
    };
  } catch (error) {
    return failure(toErrorMessage(error));
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("image-read-failed"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("image-read-failed"));
    reader.readAsDataURL(blob);
  });
}

function safeLengthValue(length: SVGAnimatedLength | undefined): number | null {
  try {
    const value = length?.baseVal?.value;
    return typeof value === "number" && Number.isFinite(value) && value > 0
      ? value
      : null;
  } catch {
    return null;
  }
}

function safeViewBoxValue(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

export function getSvgDimensions(svg: SVGSVGElement): {
  width: number;
  height: number;
} {
  const viewBox = svg.viewBox?.baseVal;
  const width =
    safeLengthValue(svg.width) ??
    safeViewBoxValue(viewBox?.width) ??
    1920;
  const height =
    safeLengthValue(svg.height) ??
    safeViewBoxValue(viewBox?.height) ??
    1080;
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

export async function rasterizeSvgElement(
  svg: SVGSVGElement,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const { width, height } = getSvgDimensions(svg);
  const serialized = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([serialized], {
    type: "image/svg+xml;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(svgBlob);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("svg-load-failed"));
      image.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas-context-unavailable");

    context.drawImage(image, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function createCaptureSlideDeps(
  fetchImageAsDataUrl?: (href: string) => Promise<string>,
): CaptureSlideDeps {
  return {
    fetchImageAsDataUrl:
      fetchImageAsDataUrl ??
      (async (href) => {
        const response = await fetch(href);
        if (!response.ok) {
          throw new Error(`image-fetch-failed:${response.status}`);
        }
        return blobToDataUrl(await response.blob());
      }),
    rasterize: (svg) => rasterizeSvgElement(svg),
  };
}
