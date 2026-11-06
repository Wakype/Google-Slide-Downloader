import { describe, expect, it, vi } from "vitest";
import { fetchAssetAsDataUrl } from "../src/background/assets";

describe("fetchAssetAsDataUrl", () => {
  it("fetches an image with credentials and returns a data URL", async () => {
    const blob = new Blob(["hello"], { type: "image/png" });
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      return new Response(blob, { status: 200 });
    });

    const dataUrl = await fetchAssetAsDataUrl(
      "https://docs.google.com/slides-images-rt/example",
      fetchImpl,
    );

    expect(dataUrl).toBe("data:image/png;base64,aGVsbG8=");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://docs.google.com/slides-images-rt/example",
      { credentials: "include" },
    );
  });

  it("rejects a non-OK asset response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      return new Response("denied", { status: 403 });
    });

    await expect(
      fetchAssetAsDataUrl(
        "https://docs.google.com/slides-images-rt/example",
        fetchImpl,
      ),
    ).rejects.toThrow("asset-fetch-failed:403");
  });
});
