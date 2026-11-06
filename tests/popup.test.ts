import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPopupController,
  renderPopup,
  type PopupEnvironment,
  type PopupState,
} from "../src/popup/popup";

function setupRoot(): HTMLElement {
  document.body.innerHTML = `<div id="app"></div>`;
  return document.getElementById("app") as HTMLElement;
}

function startButton(root: HTMLElement): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>("button.start-button");
  if (!button) {
    throw new Error("Start Capture button not found");
  }
  return button;
}

function state(overrides: Partial<PopupState> = {}): PopupState {
  return {
    phase: "ready",
    title: "My deck",
    error: null,
    supported: true,
    ...overrides,
  };
}

function environment(overrides: Partial<PopupEnvironment> = {}): PopupEnvironment {
  return {
    queryActiveTab: vi.fn(async () => ({
      url: "https://docs.google.com/presentation/d/e/abc/pub",
      title: "My deck",
    })),
    sendStart: vi.fn(async () => ({ ok: true as const, sessionId: "session-1" })),
    close: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("renderPopup", () => {
  it("renders the ready state with an enabled Start button", () => {
    const root = setupRoot();
    const onStart = vi.fn();
    renderPopup(root, state(), onStart);

    expect(root.textContent).toContain("Ready to capture");
    expect(root.textContent).toContain("My deck");
    expect(startButton(root).disabled).toBe(false);

    startButton(root).click();
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("explains unsupported pages and disables Start", () => {
    const root = setupRoot();
    renderPopup(
      root,
      state({
        phase: "unsupported",
        title: "Editor",
        supported: false,
      }),
      vi.fn(),
    );

    expect(root.textContent).toContain("/pub, /pubembed, /embed, or /preview");
    expect(startButton(root).disabled).toBe(true);
  });

  it("shows an error next to the action and keeps Start available", () => {
    const root = setupRoot();
    renderPopup(
      root,
      state({ phase: "error", error: "A capture is already running." }),
      vi.fn(),
    );

    expect(root.textContent).toContain("A capture is already running.");
    expect(startButton(root).disabled).toBe(false);
  });

  it("shows the starting state with a disabled button", () => {
    const root = setupRoot();
    renderPopup(root, state({ phase: "starting" }), vi.fn());

    expect(startButton(root).textContent).toContain("Starting…");
    expect(startButton(root).disabled).toBe(true);
  });
});

describe("popup controller", () => {
  it("renders a demo state without querying Chrome", () => {
    const root = setupRoot();
    const env = environment();
    const controller = createPopupController(root, env);

    controller.showDemo();

    expect(env.queryActiveTab).not.toHaveBeenCalled();
    expect(root.textContent).toContain("Demo deck");
    expect(startButton(root).disabled).toBe(false);
  });

  it("enables Start on a supported active tab", async () => {
    const root = setupRoot();
    const controller = createPopupController(root, environment());

    await controller.init();

    expect(root.textContent).toContain("Ready to capture");
    expect(startButton(root).disabled).toBe(false);
  });

  it("disables Start on an unsupported active tab", async () => {
    const root = setupRoot();
    const controller = createPopupController(
      root,
      environment({
        queryActiveTab: vi.fn(async () => ({
          url: "https://docs.google.com/presentation/d/abc/edit",
          title: "Editor",
        })),
      }),
    );

    await controller.init();

    expect(root.textContent).toContain("/pub, /pubembed, /embed, or /preview");
    expect(startButton(root).disabled).toBe(true);
  });

  it("closes the popup after a successful start", async () => {
    const root = setupRoot();
    const env = environment();
    const controller = createPopupController(root, env);
    await controller.init();

    await controller.start();

    expect(env.sendStart).toHaveBeenCalledTimes(1);
    expect(env.close).toHaveBeenCalledTimes(1);
  });

  it("shows the start failure next to the button", async () => {
    const root = setupRoot();
    const env = environment({
      sendStart: vi.fn(async () => ({
        ok: false as const,
        error: "A capture is already running in this tab.",
      })),
    });
    const controller = createPopupController(root, env);
    await controller.init();

    await controller.start();

    expect(root.textContent).toContain("A capture is already running");
    expect(env.close).not.toHaveBeenCalled();
    expect(startButton(root).disabled).toBe(false);
  });
});
