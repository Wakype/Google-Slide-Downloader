import { describe, expect, it } from "vitest";
import { createDemoCapture } from "../src/preview/demo";

describe("createDemoCapture", () => {
  it("creates six stable slides with non-empty SVG blobs", async () => {
    const { session, slides } = createDemoCapture(1_700_000_000_000);

    expect(session.createdAt).toBe(1_700_000_000_000);
    expect(session.title).toContain("Demo");
    expect(slides).toHaveLength(6);
    expect(slides.map((slide) => slide.filename)).toEqual([
      "slide_001.png",
      "slide_002.png",
      "slide_003.png",
      "slide_004.png",
      "slide_005.png",
      "slide_006.png",
    ]);

    for (const slide of slides) {
      expect(slide.blob.size).toBeGreaterThan(0);
      expect(slide.blob.type).toBe("image/svg+xml");
      expect(await slide.blob.text()).toContain(`Slide ${slide.index}`);
    }
  });
});
