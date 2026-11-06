import { createIcon, type IconName } from "../shared/icons";
import type { PreviewModel, PreviewSlide } from "./model";

export interface LightboxOptions {
  onDownload(slide: PreviewSlide): void;
  onClose?(closedIndex: number): void;
}

export interface LightboxController {
  open(index: number): void;
  close(): void;
  next(): void;
  previous(): void;
  isOpen(): boolean;
  currentIndex(): number | null;
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

function iconButton(
  className: string,
  label: string,
  icon: IconName,
): HTMLButtonElement {
  const button = element("button", `lightbox-button ${className}`);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(createIcon(icon));
  return button;
}

function renderLightbox(
  slide: PreviewSlide,
  index: number,
  total: number,
  options: {
    onClose(): void;
    onPrevious(): void;
    onNext(): void;
    onDownload(slide: PreviewSlide): void;
  },
): HTMLElement {
  const overlay = element("div", "lightbox");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", `Slide ${index + 1} of ${total}`);
  overlay.tabIndex = -1;

  const stage = element("div", "lightbox-stage");
  const image = element("img", "lightbox-image");
  image.src = slide.downloadUrl;
  image.alt = `Slide ${slide.index}`;

  const close = iconButton("lightbox-close", "Close preview", "close");
  const previous = iconButton(
    "lightbox-nav lightbox-prev",
    "Previous slide",
    "chevron-left",
  );
  const next = iconButton(
    "lightbox-nav lightbox-next",
    "Next slide",
    "chevron-right",
  );

  stage.append(previous, image, next, close);

  const bar = element("div", "lightbox-bar");
  const meta = element("div", "lightbox-meta");
  meta.append(
    element("p", "lightbox-filename", slide.filename),
    element("p", "lightbox-counter", `${index + 1} / ${total}`),
  );
  if (slide.warning) {
    const warning = element("p", "lightbox-warning", "Missing embedded images");
    warning.title = slide.warning;
    meta.append(warning);
  }

  const download = element("button", "button button-primary lightbox-download");
  download.type = "button";
  download.append(
    createIcon("download"),
    element("span", "button-label", "Download"),
  );

  bar.append(meta, download);
  overlay.append(stage, bar);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) options.onClose();
  });
  stage.addEventListener("click", (event) => {
    if (event.target === stage) options.onClose();
  });
  close.addEventListener("click", options.onClose);
  previous.addEventListener("click", options.onPrevious);
  next.addEventListener("click", options.onNext);
  download.addEventListener("click", () => options.onDownload(slide));

  return overlay;
}

export function createLightbox(
  model: PreviewModel,
  options: LightboxOptions,
): LightboxController {
  const total = model.slides.length;
  let index: number | null = null;
  let overlay: HTMLElement | null = null;

  function render(focus: "close" | "prev" | "next" = "close"): void {
    if (index === null) return;
    const slide = model.slides[index];
    if (!slide) return;

    overlay?.remove();
    overlay = renderLightbox(slide, index, total, {
      onClose: close,
      onPrevious: previous,
      onNext: next,
      onDownload: options.onDownload,
    });
    document.body.append(overlay);
    document.body.classList.add("has-lightbox");
    overlay
      .querySelector<HTMLButtonElement>(`.lightbox-${focus}`)
      ?.focus();
  }

  function open(
    nextIndex: number,
    focus: "close" | "prev" | "next" = "close",
  ): void {
    if (nextIndex < 0 || nextIndex >= total) return;
    index = nextIndex;
    render(focus);
  }

  function close(): void {
    if (index === null) return;
    const closedIndex = index;
    index = null;
    overlay?.remove();
    overlay = null;
    document.body.classList.remove("has-lightbox");
    options.onClose?.(closedIndex);
  }

  function next(): void {
    if (index === null) return;
    open((index + 1) % total, "next");
  }

  function previous(): void {
    if (index === null) return;
    open((index - 1 + total) % total, "prev");
  }

  const onKeydown = (event: KeyboardEvent): void => {
    if (index === null) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      previous();
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
      return;
    }
    if (event.key === "Tab" && overlay) {
      const focusable = Array.from(
        overlay.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (
        event.shiftKey &&
        (active === first || !overlay.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (active === last || !overlay.contains(active))
      ) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  document.addEventListener("keydown", onKeydown);

  return {
    open,
    close,
    next,
    previous,
    isOpen: () => index !== null,
    currentIndex: () => index,
  };
}
