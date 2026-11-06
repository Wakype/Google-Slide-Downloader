import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  openSessionStore,
  type SessionStore,
} from "../src/shared/session-store";
import type { CaptureSession, SlideRecord } from "../src/shared/types";

let store: SessionStore;
let databaseCounter = 0;

function session(id: string): CaptureSession {
  return {
    id,
    tabId: 7,
    sourceUrl: "https://docs.google.com/presentation/d/e/abc/pub",
    title: "Test deck",
    createdAt: 1_000,
    total: 2,
    captured: 0,
    failed: [],
    status: "capturing",
    error: null,
    reachedEnd: false,
  };
}

function slide(sessionId: string, index: number): SlideRecord {
  return {
    id: `${sessionId}:${index}`,
    sessionId,
    index,
    filename: `slide_00${index}.png`,
    blob: new Blob([`slide-${index}`], { type: "image/png" }),
    width: 1920,
    height: 1080,
    warning: null,
  };
}

beforeEach(async () => {
  databaseCounter += 1;
  store = await openSessionStore(indexedDB, `store-test-${databaseCounter}`);
});

afterEach(() => {
  store.close();
});

describe("SessionStore", () => {
  it("creates, reads, and updates a session", async () => {
    await store.createSession(session("one"));
    expect(await store.getSession("one")).toMatchObject({
      id: "one",
      title: "Test deck",
      status: "capturing",
    });

    const updated = await store.updateSession("one", {
      captured: 2,
      status: "complete",
    });
    expect(updated.captured).toBe(2);
    expect(updated.status).toBe("complete");
    expect((await store.getSession("one"))?.captured).toBe(2);
  });

  it("returns slides in numeric index order even when key order differs", async () => {
    await store.putSlide(slide("deck", 10));
    await store.putSlide(slide("deck", 2));

    const slides = await store.getSlides("deck");
    expect(slides.map((record) => record.index)).toEqual([2, 10]);
    expect(slides[0]?.blob.size).toBeGreaterThan(0);
  });

  it("counts only slides from the requested session", async () => {
    await store.putSlide(slide("first", 1));
    await store.putSlide(slide("second", 1));
    await store.putSlide(slide("second", 2));

    expect(await store.countSlides("first")).toBe(1);
    expect(await store.countSlides("second")).toBe(2);
  });

  it("deletes a session and its slides", async () => {
    await store.createSession(session("gone"));
    await store.putSlide(slide("gone", 1));
    await store.putSlide(slide("kept", 1));

    await store.deleteSession("gone");

    expect(await store.getSession("gone")).toBeUndefined();
    expect(await store.countSlides("gone")).toBe(0);
    expect(await store.countSlides("kept")).toBe(1);
  });
});
