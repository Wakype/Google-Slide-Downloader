const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type IconName =
  | "slides"
  | "download"
  | "merge"
  | "alert"
  | "image"
  | "close"
  | "chevron-left"
  | "chevron-right"
  | "flag";

interface IconPart {
  d: string;
  fill?: "none" | "currentColor";
}

const ICONS: Record<IconName, IconPart[]> = {
  slides: [
    {
      d: "M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
      fill: "none",
    },
    { d: "m10 9 5 3-5 3V9Z", fill: "currentColor" },
  ],
  download: [
    { d: "M12 4v10", fill: "none" },
    { d: "m8 10 4 4 4-4", fill: "none" },
    { d: "M5 19h14", fill: "none" },
  ],
  merge: [
    { d: "M14 4h6v6", fill: "none" },
    { d: "M20 4l-9 9", fill: "none" },
    {
      d: "M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4",
      fill: "none",
    },
  ],
  alert: [
    { d: "M12 3 2.5 20h19L12 3Z", fill: "none" },
    { d: "M12 9v5", fill: "none" },
    { d: "M12 17h.01", fill: "none" },
  ],
  image: [
    {
      d: "M4 5h16v14H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
      fill: "none",
    },
    { d: "m4 15 4-4 4 4 3-3 5 5", fill: "none" },
    { d: "M9 9h.01", fill: "none" },
  ],
  close: [
    { d: "m6 6 12 12", fill: "none" },
    { d: "M18 6 6 18", fill: "none" },
  ],
  "chevron-left": [{ d: "m15 18-6-6 6-6", fill: "none" }],
  "chevron-right": [{ d: "m9 18 6-6-6-6", fill: "none" }],
  flag: [
    { d: "M5 21V4", fill: "none" },
    { d: "M5 5h10l-2 4 2 4H5", fill: "none" },
  ],
};

export function createIcon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("icon");

  for (const part of ICONS[name]) {
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", part.d);
    if (part.fill === "none") {
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "1.8");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
    } else {
      path.setAttribute("fill", "currentColor");
    }
    svg.append(path);
  }

  return svg;
}
