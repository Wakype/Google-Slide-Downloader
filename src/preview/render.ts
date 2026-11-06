import { REPORT_ISSUE_URL } from "../shared/constants";
import { createIcon, type IconName } from "../shared/icons";
import type { PreviewModel, PreviewSlide } from "./model";

export interface PreviewHandlers {
  onDownloadAll(): void;
  onDownloadAllAndMerge(): void;
  onDownloadSlide(slide: PreviewSlide): void;
  onOpenSlide(slide: PreviewSlide): void;
  onClose(): void;
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

function actionButton(
  label: string,
  className: string,
  icon: IconName,
  onClick: () => void,
  disabled: boolean,
  action: "bulk" | "download",
): HTMLButtonElement {
  const button = element("button", className);
  button.type = "button";
  button.disabled = disabled;
  button.dataset.action = action;
  button.append(createIcon(icon), element("span", "button-label", label));
  button.addEventListener("click", onClick);
  return button;
}

function banner(
  tone: "error" | "warning",
  title: string,
  body: string,
): HTMLElement {
  const section = element("section", `banner banner-${tone}`);
  section.setAttribute("role", tone === "error" ? "alert" : "status");
  const text = element("div", "banner-text");
  text.append(
    element("p", "banner-title", title),
    element("p", "banner-body", body),
  );
  section.append(createIcon("alert"), text);
  return section;
}

function slideCard(
  slide: PreviewSlide,
  handlers: PreviewHandlers,
): HTMLElement {
  const card = element("article", "slide-card");

  const figure = element("figure", "slide-thumb");
  const open = element("button", "slide-open");
  open.type = "button";
  open.setAttribute("aria-label", `Open Slide ${slide.index} preview`);
  const image = element("img");
  image.src = slide.downloadUrl;
  image.alt = `Slide ${slide.index} preview`;
  image.loading = "lazy";
  image.decoding = "async";
  open.append(image);
  open.addEventListener("click", () => handlers.onOpenSlide(slide));
  figure.append(open);

  const footer = element("div", "slide-footer");
  const details = element("div", "slide-details");
  details.append(
    element("p", "filename", slide.filename),
    element("p", "dimensions", `${slide.width} × ${slide.height}`),
  );
  if (slide.warning) {
    const warningLine = element("p", "slide-warning", "Missing images");
    warningLine.title = slide.warning;
    details.append(warningLine);
  }

  const download = element("button", "icon-button");
  download.type = "button";
  download.dataset.action = "download";
  download.setAttribute("aria-label", `Download Slide ${slide.index}`);
  download.title = `Download ${slide.filename}`;
  download.append(createIcon("download"));
  download.addEventListener("click", () => handlers.onDownloadSlide(slide));

  footer.append(details, download);
  card.append(figure, footer);
  return card;
}

function emptyState(
  model: PreviewModel,
  handlers: PreviewHandlers,
): HTMLElement {
  const section = element("section", "empty");
  section.append(createIcon("image"));
  section.append(
    element(
      "h2",
      "empty-title",
      model.missing ? "Capture not found" : "No slides were captured",
    ),
    element(
      "p",
      "empty-body",
      model.error ??
        "Return to the presentation tab and run Start Capture again.",
    ),
  );

  const actions = element("div", "empty-actions");
  const close = element("button", "button button-secondary");
  close.type = "button";
  close.append(
    createIcon("close"),
    element("span", "button-label", "Close tab"),
  );
  close.addEventListener("click", handlers.onClose);
  actions.append(close);
  section.append(actions);
  return section;
}

export function renderPreview(
  root: HTMLElement,
  model: PreviewModel,
  handlers: PreviewHandlers,
): void {
  root.replaceChildren();

  const app = element("div", "app");
  const header = element("header", "topbar");

  const brand = element("div", "brand");
  const logo = element("img", "brand-logo");
  logo.src = "./icons/icon128.png";
  logo.alt = "Slides Capture";
  logo.width = 40;
  logo.height = 40;
  brand.append(logo);

  const heading = element("div", "deck-heading");
  heading.append(
    element("p", "eyebrow", model.isDemo ? "Demo preview" : "Capture preview"),
    element("h1", "title", model.title),
    element(
      "p",
      "meta",
      `${model.captured} of ${model.total} slides${
        model.sourceHost ? ` · ${model.sourceHost}` : ""
      } · ${model.capturedAt}`,
    ),
  );
  const headerActions = element("div", "topbar-actions");
  const report = element("a", "icon-button report-button");
  report.href = REPORT_ISSUE_URL;
  report.target = "_blank";
  report.rel = "noreferrer";
  report.setAttribute("aria-label", "Report an issue");
  report.title = "Report an issue";
  report.append(createIcon("flag"));
  headerActions.append(report);

  header.append(brand, heading, headerActions);
  app.append(header);

  const main = element("main", "content");
  const actions = element("section", "actions");
  const actionGroup = element("div", "action-group");
  actionGroup.append(
    actionButton(
      "Download all",
      "button button-primary",
      "download",
      handlers.onDownloadAll,
      model.isEmpty,
      "bulk",
    ),
    actionButton(
      "Download all + Merge PDF",
      "button button-secondary",
      "merge",
      handlers.onDownloadAllAndMerge,
      model.isEmpty,
      "bulk",
    ),
  );
  actions.append(
    actionGroup,
    element(
      "p",
      "action-note",
      "PDF24 opens after the downloads start. Add the PNGs there.",
    ),
  );

  const status = element("div", "status");
  status.dataset.status = "true";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  actions.append(status);
  main.append(actions);

  if (model.status === "error" && model.error && !model.missing) {
    main.append(banner("error", "Capture stopped", model.error));
  }
  if (model.reachedEnd) {
    main.append(
      banner(
        "warning",
        "Capture stopped early",
        "The viewer stopped advancing before the end of the deck. Later slides may be missing.",
      ),
    );
  }
  if (model.degradedCount > 0) {
    main.append(
      banner(
        "warning",
        "Some slides have missing images",
        `${model.degradedCount} slide(s) were captured without one or more embedded images.`,
      ),
    );
  }
  if (model.failed.length > 0) {
    main.append(
      banner(
        "warning",
        "Some slides were not captured",
        `Slides ${model.failed.join(", ")}`,
      ),
    );
  }

  if (model.isEmpty) {
    main.append(emptyState(model, handlers));
  } else {
    const grid = element("section", "grid");
    grid.setAttribute("aria-label", "Captured slides");
    for (const slide of model.slides) {
      grid.append(slideCard(slide, handlers));
    }
    main.append(grid);
  }

  const footer = element("footer", "footer");
  footer.append(
    element("p", "footer-title", "Disclaimer"),
    element(
      "p",
      "footer-text",
      "This tool is intended for educational, personal archival, and fair-use reference only.",
    ),
  );
  const disclaimer = element("ul", "footer-list");
  for (const item of [
    "Respect copyright and content ownership. Do not scrape, redistribute, or commercially exploit presentations without authorization.",
    "Users are responsible for complying with Google's Terms of Service and applicable privacy laws.",
    'The software is provided "as is", without warranty. The author assumes no liability for misuse, rate limiting, or data loss.',
  ]) {
    disclaimer.append(element("li", undefined, item));
  }
  footer.append(disclaimer);
  main.append(footer);
  app.append(main);
  root.append(app);
}

export function setPreviewStatus(
  root: HTMLElement,
  message: string,
  tone: "info" | "success" | "error" = "info",
): void {
  const status = root.querySelector<HTMLElement>("[data-status]");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
  status.classList.toggle("is-visible", message.length > 0);
}

export function setPreviewBusy(root: HTMLElement, busy: boolean): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>(
    "button[data-action]",
  );
  for (const button of buttons) button.disabled = busy;
}
