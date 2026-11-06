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
  return { ok: false, dataUrl: null, width: 0, height: 0, reason };
}

async function inlineImages(
  clone: SVGSVGElement,
  fetchImageAsDataUrl: (href: string) => Promise<string>,
): Promise<void> {
  const images = Array.from(clone.querySelectorAll("image"));
  await Promise.allSettled(
    images.map(async (image) => {
      const href =
        image.getAttribute("href") ??
        image.getAttributeNS(XLINK_NAMESPACE, "href") ??
        image.getAttribute("xlink:href");

      if (!href || href.startsWith("data:")) return;

      const dataUrl = await fetchImageAsDataUrl(href);
      image.removeAttribute("href");
      image.removeAttributeNS(XLINK_NAMESPACE, "href");
      image.removeAttribute("xlink:href");
      image.setAttribute("href", dataUrl);
    }),
  );
}

export async function captureSlide(
  doc: Document,
  deps: CaptureSlideDeps,
): Promise<CaptureResult> {
  const svg = findSvg(doc);
  if (!svg) return failure("svg-not-found");

  const clone = svg.cloneNode(true) as SVGSVGElement;
  await inlineImages(clone, deps.fetchImageAsDataUrl);

  try {
    const raster = await deps.rasterize(clone);
    return {
      ok: true,
      dataUrl: raster.dataUrl,
      width: raster.width,
      height: raster.height,
      reason: null,
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

function svgDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.viewBox?.baseVal;
  const width = Math.max(
    1,
    Math.round(svg.width?.baseVal?.value || viewBox?.width || 1920),
  );
  const height = Math.max(
    1,
    Math.round(svg.height?.baseVal?.value || viewBox?.height || 1080),
  );
  return { width, height };
}

export async function rasterizeSvgElement(
  svg: SVGSVGElement,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const { width, height } = svgDimensions(svg);
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

export function createCaptureSlideDeps(): CaptureSlideDeps {
  return {
    fetchImageAsDataUrl: async (href) => {
      const response = await fetch(href);
      if (!response.ok) {
        throw new Error(`image-fetch-failed:${response.status}`);
      }
      return blobToDataUrl(await response.blob());
    },
    rasterize: (svg) => rasterizeSvgElement(svg),
  };
}
