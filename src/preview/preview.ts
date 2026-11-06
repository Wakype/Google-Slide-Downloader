import { openSessionStore } from "../shared/session-store";
import { toErrorMessage } from "../shared/utils";
import { createDemoCapture } from "./demo";
import { downloadAll, downloadAllAndMerge, downloadSlide, type DownloadDeps } from "./downloads";
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
    download: (options) => chrome.downloads.download(options),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    openTab: (url) => chrome.tabs.create({ url }),
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
      ? "Starting downloads, then opening PDF24…"
      : "Starting downloads…",
    "info",
  );

  const deps = createDownloadDeps();
  const task =
    action === "one" && slide
      ? downloadSlide(slide, model.downloadFolder, deps)
      : action === "merge"
        ? downloadAllAndMerge(model.slides, model.downloadFolder, deps)
        : downloadAll(model.slides, model.downloadFolder, deps);

  void task
    .then(() => {
      setPreviewStatus(
        root,
        action === "merge"
          ? "Downloads started. Add the PNGs in PDF24."
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

  renderPreview(root, model, {
    onDownloadAll: () => runDownload(model, "all"),
    onDownloadAllAndMerge: () => runDownload(model, "merge"),
    onDownloadSlide: (slide) => runDownload(model, "one", slide),
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
      onClose: () => window.close(),
    },
  );
});
