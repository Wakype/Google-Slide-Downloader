import { describe, expect, it } from "vitest";
import { createDemoCapture } from "../src/preview/demo";

describe("createDemoCapture", () => {
  it("creates six stable slides with non-empty SVG blobs", async () => {
    const { session, slides } = createDemoCapture(1_700_000_000_000);

    expect(session.createdAt).toBe(1_700_000_000_000);
    expect(session.title).toContain("Demo");
    expect(slides).toHaveLength(6);
    expect(slides.map((slide) => slide.filename)).toEqual([
      "Slide_001.png",
      "Slide_002.png",
      "Slide_003.png",
      "Slide_004.png",
      "Slide_005.png",
      "Slide_006.png",
    ]);

    for (const slide of slides) {
      expect(slide.blob.size).toBeGreaterThan(0);
      expect(slide.blob.type).toBe("image/svg+xml");
      expect(await slide.blob.text()).toContain(`Slide ${slide.index}`);
    }
  });
});
