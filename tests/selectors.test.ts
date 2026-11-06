import { beforeEach, describe, expect, it } from "vitest";
import { findSvg } from "../src/capture/selectors";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("findSvg", () => {
  it("uses the viewer container itself when it is the SVG", () => {
    document.body.innerHTML = `
      <svg id="toolbar"><rect /></svg>
      <svg id="viewer" class="punch-viewer-svgpage-svgcontainer"><rect /></svg>
    `;

    expect(findSvg(document)?.id).toBe("viewer");
  });

  it("finds a nested SVG inside the viewer container", () => {
    document.body.innerHTML = `
      <svg id="toolbar"><rect /></svg>
      <div class="punch-viewer-svgpage-svgcontainer"><svg id="viewer"><rect /></svg></div>
    `;

    expect(findSvg(document)?.id).toBe("viewer");
  });
});
