import { findSetSize, findSlideCounter, findSvg } from "../capture/selectors";

export function isSlidesPresentationUrl(raw: string | undefined): boolean {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    if (url.hostname !== "docs.google.com") return false;
    return /^\/presentation\/(?:.*\/)?(?:pub|pubembed|present|embed|preview)$/.test(
      url.pathname,
    );
  } catch {
    return false;
  }
}

export function formatSlideFilename(index: number): string {
  return `Slide_${String(index).padStart(3, "0")}.png`;
}

export function parseTotalSlides(doc: Document): number | null {
  const attribute = findSetSize(doc)?.getAttribute("aria-setsize");
  const fromAttribute = Number.parseInt(attribute ?? "", 10);
  if (Number.isFinite(fromAttribute) && fromAttribute > 0) {
    return fromAttribute;
  }

  const caption = findSlideCounter(doc)?.textContent?.trim() ?? "";
  const match = /(\d+)\s*(?:of|\/)\s*(\d+)/i.exec(caption);
  const fromCaption = Number.parseInt(match?.[2] ?? "", 10);
  if (Number.isFinite(fromCaption) && fromCaption > 0) {
    return fromCaption;
  }

  return null;
}

function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function getSlideSignature(doc: Document): string {
  const counter = findSlideCounter(doc);
  const counterText = counter
    ? (counter.getAttribute("aria-posinset") ?? counter.textContent?.trim() ?? "")
    : "";

  const svg = findSvg(doc);
  if (!svg) return `${counterText}::no-svg`;

  const text = (svg.textContent ?? "").trim().slice(0, 120);
  const htmlLength = svg.innerHTML.length;
  return `${counterText}::${text.length}:${htmlLength}:${hashText(text)}`;
}

export function sanitizeFilenamePart(value: string): string {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 80)
    .trim();
  return cleaned || "Presentation";
}

export function cleanDeckTitle(title: string): string {
  return title.replace(/\s*[-–—]\s*Google Slides\s*$/i, "").trim();
}

export function buildDeckFolder(title: string): string {
  return `Slides/${sanitizeFilenamePart(cleanDeckTitle(title))}`;
}

export function buildSlideDownloadPath(
  title: string,
  filename: string,
): string {
  return `${buildDeckFolder(title)}/${filename}`;
}

export function formatCapturedAt(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
