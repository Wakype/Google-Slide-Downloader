import { describe, expect, it } from "vitest";
import {
  buildPreviewModel,
  createMissingModel,
} from "../src/preview/model";
import type { CaptureSession, SlideRecord } from "../src/shared/types";

const session: CaptureSession = {
  id: "session-1",
  tabId: 7,
  sourceUrl: "https://docs.google.com/presentation/d/e/abc/pub",
  title: "My: Deck",
  createdAt: 1_700_000_000_000,
  total: 2,
  captured: 2,
  failed: [],
  status: "complete",
  error: null,
  reachedEnd: true,
};

const slides: SlideRecord[] = [
  {
    id: "session-1:1",
    sessionId: "session-1",
    index: 1,
    filename: "slide_001.png",
    blob: new Blob(["one"], { type: "image/png" }),
    width: 1920,
    height: 1080,
    warning: null,
  },
  {
    id: "session-1:2",
    sessionId: "session-1",
    index: 2,
    filename: "slide_002.png",
    blob: new Blob(["two"], { type: "image/png" }),
    width: 1920,
    height: 1080,
    warning: null,
  },
];

describe("buildPreviewModel", () => {
  it("maps a completed session to display fields", () => {
    const model = buildPreviewModel(
      session,
      slides,
      new Map([
        ["session-1:1", "blob:one"],
        ["session-1:2", "blob:two"],
      ]),
    );

    expect(model.title).toBe("My: Deck");
    expect(model.sourceHost).toBe("docs.google.com");
    expect(model.total).toBe(2);
    expect(model.captured).toBe(2);
    expect(model.isEmpty).toBe(false);
    expect(model.downloadFolder).toBe("Slides/My Deck");
    expect(model.reachedEnd).toBe(true);
    expect(model.degradedCount).toBe(0);
    expect(model.slides[0]).toMatchObject({
      index: 1,
      filename: "slide_001.png",
      downloadUrl: "blob:one",
    });
  });

  it("marks a session with no slides as empty", () => {
    const model = buildPreviewModel(session, [], new Map());
    expect(model.isEmpty).toBe(true);
    expect(model.total).toBe(2);
    expect(model.captured).toBe(0);
  });

  it("counts slides with missing embedded images", () => {
    const model = buildPreviewModel(
      session,
      [
        slides[0]!,
        { ...slides[1]!, warning: "1 embedded image could not be inlined." },
      ],
      new Map([
        ["session-1:1", "blob:one"],
        ["session-1:2", "blob:two"],
      ]),
    );
    expect(model.degradedCount).toBe(1);
  });

  it("uses the traversed count when the session total is unknown", () => {
    const model = buildPreviewModel(
      { ...session, total: null, captured: 1, failed: [2] },
      slides.slice(0, 1),
      new Map([["session-1:1", "blob:one"]]),
    );
    expect(model.total).toBe(2);
  });

  it("preserves failed slide indexes", () => {
    const model = buildPreviewModel(
      { ...session, failed: [3, 5], captured: 1 },
      slides.slice(0, 1),
      new Map([["session-1:1", "blob:one"]]),
    );
    expect(model.failed).toEqual([3, 5]);
  });
});

describe("createMissingModel", () => {
  it("describes a missing capture with one clear recovery path", () => {
    const model = createMissingModel();
    expect(model.missing).toBe(true);
    expect(model.isEmpty).toBe(true);
    expect(model.title).toBe("Capture not found");
    expect(model.error).toContain("No capture was found");
  });
});
