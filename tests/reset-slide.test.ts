import { beforeEach, describe, expect, it } from "vitest";
import { resetToFirstSlide } from "../src/capture/reset-slide";
import { getCurrentSlide } from "../src/shared/utils";

const immediateSleep = () => Promise.resolve();

function setup(
  current: number,
  options: { home?: boolean; prevListener?: boolean } = {},
): { getValue: () => number } {
  document.body.innerHTML = `
    <div aria-posinset="${current}" class="docs-material-menu-button-flat-default-caption">${current} of 3</div>
    <div class="punch-viewer-navbar-prev"></div>
  `;
  const counter = document.querySelector("[aria-posinset]") as HTMLElement;
  const prev = document.querySelector(".punch-viewer-navbar-prev") as HTMLElement;
  let value = current;

  const setValue = (next: number) => {
    value = next;
    counter.setAttribute("aria-posinset", String(next));
    counter.textContent = `${next} of 3`;
  };

  if (options.prevListener !== false) {
    prev.addEventListener("click", () => {
      if (value > 1) setValue(value - 1);
    });
  }
  if (options.home) {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Home") setValue(1);
    });
  }

  return { getValue: () => value };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("getCurrentSlide", () => {
  it("reads aria-posinset or the caption", () => {
    document.body.innerHTML = `<div aria-posinset="4">4 of 9</div>`;
    expect(getCurrentSlide(document)).toBe(4);

    document.body.innerHTML = `<div class="docs-material-menu-button-flat-default-caption">7 of 9</div>`;
    expect(getCurrentSlide(document)).toBe(7);

    document.body.innerHTML = `<div class="punch-viewer-container"></div>`;
    expect(getCurrentSlide(document)).toBeNull();
  });
});

describe("resetToFirstSlide", () => {
  it("does nothing when already on slide 1", async () => {
    const viewer = setup(1, { home: false, prevListener: false });
    await expect(
      resetToFirstSlide(document, { sleep: immediateSleep, checkMs: 0 }),
    ).resolves.toBe(true);
    expect(viewer.getValue()).toBe(1);
  });

  it("uses the Home key when the viewer supports it", async () => {
    const viewer = setup(3, { home: true });
    await expect(
      resetToFirstSlide(document, { sleep: immediateSleep, checkMs: 0 }),
    ).resolves.toBe(true);
    expect(viewer.getValue()).toBe(1);
  });

  it("falls back to the previous-slide button", async () => {
    const viewer = setup(3, { home: false });
    await expect(
      resetToFirstSlide(document, { sleep: immediateSleep, checkMs: 0 }),
    ).resolves.toBe(true);
    expect(viewer.getValue()).toBe(1);
  });

  it("returns false when the viewer cannot be moved", async () => {
    setup(3, { home: false, prevListener: false });
    await expect(
      resetToFirstSlide(document, { sleep: immediateSleep, checkMs: 0 }),
    ).resolves.toBe(false);
  });

  it("returns false when the current position cannot be detected", async () => {
    document.body.innerHTML = `<div class="punch-viewer-container"></div>`;
    await expect(
      resetToFirstSlide(document, { sleep: immediateSleep, checkMs: 0 }),
    ).resolves.toBe(false);
  });
});
