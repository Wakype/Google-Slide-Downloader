import { openSessionStore } from "../shared/session-store";
import { toErrorMessage } from "../shared/utils";
import { createDemoCapture } from "./demo";
import { downloadAll, downloadAllAndMerge, downloadSlide, type DownloadDeps } from "./downloads";
import { createLightbox } from "./lightbox";
import {
  buildPreviewModel,
  createMissingModel,
  type PreviewModel,
  type PreviewSlide,
} from "./model";
import {
  renderPreview,
  setPreviewBusy,
  setPreviewStatus,
} from "./render";

const appRoot = document.getElementById("app");
if (!appRoot) throw new Error("preview root missing");
const root: HTMLElement = appRoot;

function createDownloadDeps(): DownloadDeps {
  return {
    save: (url, filename) => {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    openTab: (url) => {
      window.open(url, "_blank", "noopener");
    },
  };
}

function runDownload(
  model: PreviewModel,
  action: "all" | "merge" | "one",
  slide?: PreviewSlide,
): void {
  if (model.isDemo) {
    setPreviewStatus(root, "Demo mode: downloads are disabled.", "info");
    return;
  }
  if (model.isEmpty) return;

  setPreviewBusy(root, true);
  setPreviewStatus(
    root,
    action === "merge"
      ? "Opening PDF24 and starting downloads…"
      : "Starting downloads…",
    "info",
  );

  const deps = createDownloadDeps();
  const task =
    action === "one" && slide
      ? downloadSlide(slide, deps)
      : action === "merge"
        ? downloadAllAndMerge(model.slides, deps)
        : downloadAll(model.slides, deps);

  void task
    .then(() => {
      setPreviewStatus(
        root,
        action === "merge"
          ? "PDF24 opened. Downloads started."
          : "Downloads started.",
        "success",
      );
    })
    .catch((error: unknown) => {
      setPreviewStatus(root, toErrorMessage(error), "error");
    })
    .finally(() => setPreviewBusy(root, false));
}

async function loadSession(sessionId: string): Promise<{
  model: PreviewModel;
  revoke: () => void;
}> {
  const store = await openSessionStore();
  try {
    const session = await store.getSession(sessionId);
    const slides = session ? await store.getSlides(sessionId) : [];
    if (!session) {
      return { model: createMissingModel(), revoke: () => undefined };
    }
    const objectUrls = new Map(
      slides.map((slide) => [slide.id, URL.createObjectURL(slide.blob)]),
    );
    return {
      model: buildPreviewModel(session, slides, objectUrls),
      revoke: () => {
        for (const url of objectUrls.values()) URL.revokeObjectURL(url);
      },
    };
  } finally {
    store.close();
  }
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  let model: PreviewModel;
  let revoke: () => void = () => undefined;

  if (params.get("demo") === "1") {
    const demo = createDemoCapture();
    const objectUrls = new Map(
      demo.slides.map((slide) => [slide.id, URL.createObjectURL(slide.blob)]),
    );
    model = buildPreviewModel(demo.session, demo.slides, objectUrls, true);
    revoke = () => {
      for (const url of objectUrls.values()) URL.revokeObjectURL(url);
    };
  } else {
    const sessionId = params.get("session");
    if (!sessionId) {
      model = createMissingModel();
    } else {
      ({ model, revoke } = await loadSession(sessionId));
    }
  }

  const lightbox = createLightbox(model, {
    onDownload: (slide) => runDownload(model, "one", slide),
    onClose: (closedIndex) => {
      const closedSlide = model.slides[closedIndex];
      if (!closedSlide) return;
      root
        .querySelector<HTMLButtonElement>(
          `button[aria-label="Open Slide ${closedSlide.index} preview"]`,
        )
        ?.focus();
    },
  });

  renderPreview(root, model, {
    onDownloadAll: () => runDownload(model, "all"),
    onDownloadAllAndMerge: () => runDownload(model, "merge"),
    onDownloadSlide: (slide) => runDownload(model, "one", slide),
    onOpenSlide: (slide) => {
      const index = model.slides.findIndex(
        (candidate) => candidate.index === slide.index,
      );
      if (index >= 0) lightbox.open(index);
    },
    onClose: () => window.close(),
  });

  window.addEventListener("pagehide", revoke, { once: true });
}

void main().catch((error: unknown) => {
  renderPreview(
    root,
    { ...createMissingModel(), error: toErrorMessage(error) },
    {
      onDownloadAll: () => undefined,
      onDownloadAllAndMerge: () => undefined,
      onDownloadSlide: () => undefined,
      onOpenSlide: () => undefined,
      onClose: () => window.close(),
    },
  );
});
