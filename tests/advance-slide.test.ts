import { beforeEach, describe, expect, it, vi } from "vitest";
import { advanceSingleSlide } from "../src/capture/advance-slide";

function setupViewer(): { coat: HTMLElement; svg: SVGSVGElement } {
  document.body.innerHTML = `
    <div class="docs-material-menu-button-flat-default-caption" aria-posinset="1">1 of 3</div>
    <div class="punch-viewer-svgpage-svgcontainer"><svg><text>one</text></svg></div>
    <div class="punch-viewer-coat"></div>
  `;
  return {
    coat: document.querySelector(".punch-viewer-coat") as HTMLElement,
    svg: document.querySelector("svg") as SVGSVGElement,
  };
}

const immediateSleep = () => Promise.resolve();

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("advanceSingleSlide", () => {
  it("uses the overlay click when it changes the slide", async () => {
    const { coat, svg } = setupViewer();
    const keydown = vi.fn();
    const wheel = vi.fn();
    coat.addEventListener("click", () => {
      svg.textContent = "two";
    });
    document.addEventListener("keydown", keydown);
    coat.addEventListener("wheel", wheel);

    await expect(
      advanceSingleSlide(document, { sleep: immediateSleep, checkMs: 0 }),
    ).resolves.toBe(true);
    expect(keydown).not.toHaveBeenCalled();
    expect(wheel).not.toHaveBeenCalled();
  });

  it("falls back to ArrowRight when clicking does not move", async () => {
    const { coat, svg } = setupViewer();
    const wheel = vi.fn();
    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") svg.textContent = "two";
    });
    coat.addEventListener("wheel", wheel);

    await expect(
      advanceSingleSlide(document, { sleep: immediateSleep, checkMs: 0 }),
    ).resolves.toBe(true);
    expect(wheel).not.toHaveBeenCalled();
  });

  it("falls back to the wheel when click and keyboard do not move", async () => {
    const { coat, svg } = setupViewer();
    coat.addEventListener("wheel", () => {
      svg.textContent = "two";
    });

    await expect(
      advanceSingleSlide(document, { sleep: immediateSleep, checkMs: 0 }),
    ).resolves.toBe(true);
  });

  it("returns false when no strategy changes the slide", async () => {
    setupViewer();
    await expect(
      advanceSingleSlide(document, { sleep: immediateSleep, checkMs: 0 }),
    ).resolves.toBe(false);
  });
});
