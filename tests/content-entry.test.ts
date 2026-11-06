import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface SlidesCaptureWindow extends Window {
  __slidesCaptureLoaded?: boolean;
}

const addListener = vi.fn();

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = `
    <div class="punch-viewer-svgpage-svgcontainer"><svg viewBox="0 0 100 100"></svg></div>
  `;
  const windowWithGuard = window as SlidesCaptureWindow;
  delete windowWithGuard.__slidesCaptureLoaded;
  addListener.mockClear();
  vi.stubGlobal("chrome", {
    runtime: {
      onMessage: { addListener },
      sendMessage: vi.fn(async () => ({ ok: true })),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  const windowWithGuard = window as SlidesCaptureWindow;
  delete windowWithGuard.__slidesCaptureLoaded;
});

describe("content entry", () => {
  it("registers only one message listener when injected twice", async () => {
    await import("../src/content");
    expect(addListener).toHaveBeenCalledTimes(1);

    vi.resetModules();
    await import("../src/content");
    expect(addListener).toHaveBeenCalledTimes(1);
  });
});
