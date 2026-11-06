import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const dist = path.join(process.cwd(), "dist");
const manifestPath = path.join(dist, "manifest.json");

if (!existsSync(manifestPath)) {
  console.error("build check failed: dist/manifest.json is missing");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const required = new Set([
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...Object.values(manifest.icons ?? {}),
  ...manifest.content_scripts.flatMap((script) => script.js ?? []),
  "popup.js",
  "popup.css",
  "preview.html",
  "preview.js",
  "preview.css",
]);

const missing = [...required].filter((file) => {
  const full = path.join(dist, file);
  return !existsSync(full) || statSync(full).size === 0;
});

if (missing.length > 0) {
  console.error(`build check failed: missing ${missing.join(", ")}`);
  process.exit(1);
}

console.log(`build check passed (${required.size} files)`);
