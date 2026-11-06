import { createIcon } from "../shared/icons";
import type {
  StartCaptureMessage,
  StartCaptureResponse,
} from "../shared/messages";
import { isSlidesPresentationUrl, toErrorMessage } from "../shared/utils";

export type PopupPhase =
  | "checking"
  | "ready"
  | "unsupported"
  | "starting"
  | "error";

export interface PopupState {
  phase: PopupPhase;
  title: string | null;
  error: string | null;
  supported: boolean;
  limit: number | null;
}

export interface PopupTab {
  url?: string;
  title?: string;
}

export interface PopupEnvironment {
  queryActiveTab(): Promise<PopupTab | undefined>;
  sendStart(limit: number | null): Promise<StartCaptureResponse>;
  close(): void;
}

export interface PopupController {
  init(): Promise<void>;
  start(limit?: number | null): Promise<void>;
  showDemo(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function statusTitle(state: PopupState): string {
  switch (state.phase) {
    case "checking":
      return "Checking this tab…";
    case "ready":
      return "Ready to capture";
    case "unsupported":
      return "Not a supported page";
    case "starting":
      return "Starting capture…";
    case "error":
      return "Could not start";
  }
}

function statusDetail(state: PopupState): string {
  switch (state.phase) {
    case "checking":
      return "Looking for a published presentation.";
    case "ready":
      return state.title ?? "Published presentation detected.";
    case "unsupported":
      return "Open a published Google Slides deck (/pub, /pubembed, /embed, or /preview).";
    case "starting":
      return "The popup closes and progress moves to the toolbar badge.";
    case "error":
      return "The capture did not begin.";
  }
}

export function renderPopup(
  root: HTMLElement,
  state: PopupState,
  onStart: (limit: number | null) => void,
): void {
  root.replaceChildren();

  const popup = element("div", "popup");
  const header = element("header", "popup-header");
  const mark = element("img", "brand-mark");
  mark.src = "./icons/icon128.png";
  mark.alt = "";
  mark.width = 38;
  mark.height = 38;
  const brandCopy = element("div", "brand-copy");
  brandCopy.append(
    element("p", "app-name", "Slides Capture"),
    element("p", "app-tagline", "Published Google Slides → PNG → PDF"),
  );
  header.append(mark, brandCopy);

  const status = element("section", "status-card");
  status.dataset.tone = state.phase;
  const statusCopy = element("div", "status-copy");
  statusCopy.append(
    element("p", "status-title", statusTitle(state)),
    element("p", "status-detail", statusDetail(state)),
  );
  status.append(element("span", "status-dot"), statusCopy);

  const options = element("fieldset", "capture-options");
  options.append(element("legend", "options-legend", "Slides to capture"));

  const allRow = element("div", "option-row");
  const allLabel = element("label", "option-label");
  const allRadio = element("input", "option-radio");
  allRadio.type = "radio";
  allRadio.name = "capture-mode";
  allRadio.value = "all";
  allRadio.checked = state.limit === null;
  allLabel.append(allRadio, element("span", "option-text", "All slides"));
  allRow.append(allLabel);

  const someRow = element("div", "option-row option-row-count");
  const someLabel = element("label", "option-label");
  const someRadio = element("input", "option-radio");
  someRadio.type = "radio";
  someRadio.name = "capture-mode";
  someRadio.value = "some";
  someRadio.checked = state.limit !== null;
  someLabel.append(someRadio, element("span", "option-text", "Some slides"));
  const countInput = element("input", "count-input");
  countInput.type = "number";
  countInput.min = "1";
  countInput.max = "500";
  countInput.step = "1";
  countInput.value = String(state.limit ?? 5);
  countInput.disabled = state.limit === null;
  countInput.setAttribute("aria-label", "Number of slides to capture");
  someRow.append(someLabel, countInput);

  const syncCount = () => {
    countInput.disabled = !someRadio.checked;
    if (someRadio.checked) countInput.focus();
  };
  allRadio.addEventListener("change", syncCount);
  someRadio.addEventListener("change", syncCount);

  options.append(allRow, someRow);

  const readLimit = (): number | null => {
    if (!someRadio.checked) return null;
    const parsed = Number.parseInt(countInput.value, 10);
    const clamped = Number.isFinite(parsed)
      ? Math.min(500, Math.max(1, parsed))
      : 1;
    countInput.value = String(clamped);
    return clamped;
  };

  const errorBox = element("div", "popup-error");
  errorBox.setAttribute("role", "alert");
  errorBox.append(
    createIcon("alert"),
    element(
      "p",
      "popup-error-text",
      state.error ?? "The capture did not begin.",
    ),
  );

  const startButton = element("button", "start-button");
  startButton.type = "button";
  startButton.disabled =
    !state.supported ||
    state.phase === "checking" ||
    state.phase === "starting";
  startButton.append(
    createIcon("download"),
    element(
      "span",
      "start-label",
      state.phase === "starting" ? "Starting…" : "Start Capture",
    ),
  );
  startButton.addEventListener("click", () => onStart(readLimit()));

  const hint = element(
    "p",
    "popup-hint",
    "Keep the presentation tab visible while it captures. Each slide takes about a second.",
  );
  const footer = element("footer", "popup-footer");
  footer.append(
    element(
      "p",
      "popup-disclaimer",
      "Educational and personal archival use only. Respect copyright and Google's Terms of Service.",
    ),
  );

  popup.append(header, status, options);
  if (state.phase === "error") popup.append(errorBox);
  popup.append(startButton, hint, footer);
  root.append(popup);
}

export function createPopupController(
  root: HTMLElement,
  environment: PopupEnvironment,
): PopupController {
  let state: PopupState = {
    phase: "checking",
    title: null,
    error: null,
    supported: false,
    limit: null,
  };

  function draw(): void {
    renderPopup(root, state, (limit) => {
      void start(limit);
    });
  }

  async function init(): Promise<void> {
    draw();
    try {
      const tab = await environment.queryActiveTab();
      if (tab && isSlidesPresentationUrl(tab.url)) {
        state = {
          phase: "ready",
          title: tab.title?.trim() || "Google Slides",
          error: null,
          supported: true,
          limit: state.limit,
        };
      } else {
        state = {
          phase: "unsupported",
          title: tab?.title?.trim() || null,
          error: null,
          supported: false,
          limit: state.limit,
        };
      }
    } catch (error) {
      state = {
        phase: "error",
        title: null,
        error: toErrorMessage(error),
        supported: false,
        limit: state.limit,
      };
    }
    draw();
  }

  async function start(limit: number | null = null): Promise<void> {
    if (state.phase !== "ready" || !state.supported) return;

    state = { ...state, phase: "starting", limit, error: null };
    draw();

    try {
      const response = await environment.sendStart(limit);
      if (response.ok) {
        environment.close();
        return;
      }
      state = {
        phase: "error",
        title: state.title,
        error: response.error,
        supported: true,
        limit,
      };
    } catch (error) {
      state = {
        phase: "error",
        title: state.title,
        error: toErrorMessage(error),
        supported: true,
        limit,
      };
    }
    draw();
  }

  function showDemo(): void {
    state = {
      phase: "ready",
      title: "Demo deck — product launch",
      error: null,
      supported: true,
      limit: null,
    };
    draw();
  }

  return { init, start, showDemo };
}

function isStartCaptureResponse(value: unknown): value is StartCaptureResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    typeof (value as { ok: unknown }).ok === "boolean"
  );
}

const popupRoot = document.getElementById("app");
if (popupRoot) {
  const hasChrome =
    typeof chrome !== "undefined" &&
    Boolean(chrome.tabs) &&
    Boolean(chrome.runtime);
  const params = new URLSearchParams(location.search);

  const environment: PopupEnvironment = hasChrome
    ? {
        queryActiveTab: async () => {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          return tab ? { url: tab.url, title: tab.title } : undefined;
        },
        sendStart: async (limit) => {
          const message: StartCaptureMessage = {
            type: "START_CAPTURE",
            limit,
          };
          const response = await chrome.runtime.sendMessage(message);
          return isStartCaptureResponse(response)
            ? response
            : {
                ok: false,
                error: "Unexpected response from the extension worker.",
              };
        },
        close: () => window.close(),
      }
    : {
        queryActiveTab: async () => undefined,
        sendStart: async () => ({
          ok: false,
          error: "Chrome APIs are not available in this view.",
        }),
        close: () => window.close(),
      };

  const controller = createPopupController(popupRoot, environment);
  if (params.get("demo") === "1" || !hasChrome) {
    controller.showDemo();
  } else {
    void controller.init();
  }
}
