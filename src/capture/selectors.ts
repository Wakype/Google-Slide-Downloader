export const SELECTORS = {
  svgContainer: ".punch-viewer-svgpage-svgcontainer",
  fallbackSvg: "svg",
  coat: ".punch-viewer-coat",
  viewerContainer: ".punch-viewer-container",
  slideCounter: ".docs-material-menu-button-flat-default-caption",
  ariaPosInset: "[aria-posinset]",
  ariaSetSize: "[aria-setsize]",
} as const;

function asSvg(element: Element | null): SVGSVGElement | null {
  if (!element || element.tagName.toLowerCase() !== "svg") return null;
  return element as unknown as SVGSVGElement;
}

export function findSvg(doc: Document): SVGSVGElement | null {
  const container = doc.querySelector(SELECTORS.svgContainer);
  return (
    asSvg(container) ??
    asSvg(container?.querySelector("svg") ?? null) ??
    asSvg(doc.querySelector(SELECTORS.fallbackSvg))
  );
}

export function findCoat(doc: Document): Element | null {
  return (
    doc.querySelector(SELECTORS.coat) ??
    doc.querySelector(SELECTORS.svgContainer) ??
    doc.querySelector(SELECTORS.viewerContainer)
  );
}

export function findSlideCounter(doc: Document): Element | null {
  return (
    doc.querySelector(SELECTORS.slideCounter) ??
    doc.querySelector(SELECTORS.ariaPosInset)
  );
}

export function findSetSize(doc: Document): Element | null {
  return doc.querySelector(SELECTORS.ariaSetSize);
}
