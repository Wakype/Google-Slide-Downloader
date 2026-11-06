import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const manifestPath = join(root, "manifest.json");

interface Manifest {
  manifest_version: number;
  name: string;
  version: string;
  background: { service_worker: string; type: string };
  action: { default_popup: string; default_icon: Record<string, string> };
  icons: Record<string, string>;
  permissions: string[];
  host_permissions: string[];
  content_scripts: Array<{ matches: string[]; js: string[] }>;
}

function readManifest(): Manifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
}

describe("extension manifest", () => {
  it("exists as a Manifest V3 extension", () => {
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = readManifest();
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBe("Slides Capture");
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("declares the service worker as an ES module", () => {
    const manifest = readManifest();
    expect(manifest.background).toEqual({
      service_worker: "background.js",
      type: "module",
    });
  });

  it("declares the popup and icons", () => {
    const manifest = readManifest();
    expect(manifest.action.default_popup).toBe("popup.html");
    expect(manifest.action.default_icon).toEqual({
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    });
    expect(manifest.icons).toEqual(manifest.action.default_icon);
  });

  it("runs the content script on Google Slides presentation pages", () => {
    const manifest = readManifest();
    expect(manifest.content_scripts).toHaveLength(1);
    expect(manifest.content_scripts[0]?.matches).toContain(
      "https://docs.google.com/presentation/*",
    );
    expect(manifest.content_scripts[0]?.js).toContain("content.js");
  });

  it("requests only the permissions the extension needs", () => {
    const manifest = readManifest();
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["tabs", "scripting", "storage"]),
    );
    expect(manifest.host_permissions).toEqual(
      expect.arrayContaining([
        "https://docs.google.com/presentation/*",
        "https://docs.google.com/slides-images-rt/*",
        "https://*.googleusercontent.com/*",
      ]),
    );
  });

  it("has source shells and icon sources for every referenced file", () => {
    for (const path of [
      "src/background.ts",
      "src/content.ts",
      "src/popup/popup.html",
      "src/preview/preview.html",
      "public/icons/icon16.png",
      "public/icons/icon32.png",
      "public/icons/icon48.png",
      "public/icons/icon128.png",
    ]) {
      expect(existsSync(join(root, path)), path).toBe(true);
    }
  });
});
