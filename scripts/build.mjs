import { context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dist = path.join(root, "dist");
const isWatch = process.argv.includes("--watch");

const common = {
  bundle: true,
  sourcemap: true,
  minify: false,
  target: ["chrome116"],
  logLevel: "info",
};

const scriptEntries = [
  { entry: "src/background.ts", name: "background", format: "esm" },
  { entry: "src/content.ts", name: "content", format: "iife" },
  { entry: "src/popup/popup.ts", name: "popup", format: "esm" },
  { entry: "src/preview/preview.ts", name: "preview", format: "esm" },
];

const styleEntries = [
  { entry: "src/popup/popup.css", name: "popup" },
  { entry: "src/preview/preview.css", name: "preview" },
];

async function copyStatic() {
  await cp(path.join(root, "manifest.json"), path.join(dist, "manifest.json"));
  await cp(path.join(root, "public"), dist, { recursive: true });
  await cp(
    path.join(root, "src/popup/popup.html"),
    path.join(dist, "popup.html"),
  );
  await cp(
    path.join(root, "src/preview/preview.html"),
    path.join(dist, "preview.html"),
  );
}

async function buildOnce() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await copyStatic();

  for (const { entry, name, format } of scriptEntries) {
    await context({
      ...common,
      entryPoints: [entry],
      outfile: path.join(dist, `${name}.js`),
      format,
    }).then((ctx) => ctx.rebuild().finally(() => ctx.dispose()));
  }

  for (const { entry, name } of styleEntries) {
    await context({
      ...common,
      entryPoints: [entry],
      outfile: path.join(dist, `${name}.css`),
    }).then((ctx) => ctx.rebuild().finally(() => ctx.dispose()));
  }

  console.log(`built ${path.relative(root, dist)}`);
}

async function watchOnce() {
  await buildOnce();

  let timer;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      buildOnce().catch((error) => {
        console.error(error);
      });
    }, 150);
  };

  watch(path.join(root, "src"), { recursive: true }, rebuild);
  watch(path.join(root, "public"), { recursive: true }, rebuild);
  watch(path.join(root, "manifest.json"), rebuild);
  console.log("watching src/, public/, and manifest.json");
}

if (isWatch) {
  await watchOnce();
} else {
  await buildOnce();
}
