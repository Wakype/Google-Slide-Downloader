# Google Slides Capture Extension — Implementation Plan

## Context

Spec: `docs/superpowers/specs/2026-11-06-google-slides-capture-extension-design.md`

The repository currently contains `downloadAsPNG.js` (a console script that captures the
published Google Slides viewer and downloads PNGs) and a README. The task is to turn that
into a Manifest V3 Chrome extension in TypeScript with a popup, a background service
worker, a content script, a preview tab, and PDF24 integration.

The user explicitly handed off to inline execution with `executing-plans`. No prior plan
file existed in this worktree; this plan is authored from the settled conversation and
the design spec. See the ledger ruling.

Work happens in:
`E:\VESTIA\Project\Google-Slide-Downloader\.kilo\worktrees\zealous-honeycrisp`

## Global Constraints

- Manifest V3, TypeScript strict mode, no remote code, no analytics.
- Build with esbuild; type-check with `tsc --noEmit`; test with Vitest + jsdom.
- `chrome` APIs are injected into testable modules; production entry points pass the real
  `chrome` object.
- `src/capture/selectors.ts` is the only place that names Google Slides classes/attributes.
- The slides tab must remain focused for the whole capture; preview opens only at the end.
- One commit per task. Run the whole suite before each completion claim.
- Do not modify `downloadAsPNG.js`; it remains the legacy script. Update `README.md` in Task 6.

## Interfaces

### Task 2 produces

`src/shared/types.ts`

```ts
type CaptureStatus = "capturing" | "complete" | "error";

interface CaptureSession {
  id: string;
  tabId: number;
  sourceUrl: string;
  title: string;
  createdAt: number;
  total: number | null;
  captured: number;
  failed: number[];
  status: CaptureStatus;
  error: string | null;
  reachedEnd: boolean;
}

interface SlideRecord {
  id: string;
  sessionId: string;
  index: number;
  filename: string;
  blob: Blob;
  width: number;
  height: number;
}

interface CaptureResult {
  ok: boolean;
  dataUrl: string | null;
  width: number;
  height: number;
  reason: string | null;
}

interface CaptureSummary {
  total: number;
  captured: number;
  failed: number[];
  reachedEnd: boolean;
  cancelled: boolean;
  error: string | null;
}
```

`src/shared/utils.ts`

```ts
function isSlidesPresentationUrl(raw: string | undefined): boolean;
function formatSlideFilename(index: number): string;       // Slide_001.png
function parseTotalSlides(doc: Document): number | null;
function getSlideSignature(doc: Document): string;
function sanitizeFilenamePart(value: string): string;
function buildSlideDownloadPath(title: string, filename: string): string;
```

`src/capture/run-capture.ts`

```ts
interface RunCaptureOptions {
  document: Document;
  sleep: (ms: number) => Promise<void>;
  capture: (index: number) => Promise<CaptureResult>;
  advance: () => Promise<boolean>;
  onSlide: (slide: { index: number; dataUrl: string; width: number; height: number }) => Promise<void>;
  onProgress: (progress: { current: number; total: number; failed: number[] }) => Promise<void> | void;
  isCancelled?: () => boolean;
  maxSlides?: number;
  settleMs?: number;
  advanceAttempts?: number;
  advanceRetryMs?: number;
}

function runCapture(options: RunCaptureOptions): Promise<CaptureSummary>;
```

### Task 3 produces

`src/shared/session-store.ts` — `openSessionStore(factory?: IDBFactory)` returns a
`SessionStore` with `createSession`, `getSession`, `updateSession`, `putSlide`,
`getSlides`, `countSlides`, `deleteSession`, `close`.

`src/background/controller.ts` — `createBackgroundController(deps)` returns
`startCapture`, `handleSlide`, `handleProgress`, `handleComplete`, `handleError`.
`deps` contains a narrow `BackgroundChrome`, `SessionStore`, `now`, `uuid`.

`src/content/controller.ts` — `createContentController(deps)` returns
`isRunning()` and `run(message)`. `deps` contains a narrow `ContentRuntime`,
the real `capture`/`advance` functions, `document`, `sleep`, and timings.

### Task 4 produces

`src/preview/model.ts`, `src/preview/render.ts`, `src/preview/downloads.ts`.
Task 3's `SlideRecord` and `CaptureSession` are consumed unchanged.

### Task 5 produces

`src/popup/popup.ts` plus render helpers. It consumes `isSlidesPresentationUrl` and
the `START_CAPTURE` message type from Task 2/3.

### Task 6 produces

Final README, icons, demo mode, and the verified `dist/` build.

## Review Focus

- Google Slides selector assumptions and the advance ladder's event targets.
- Every message crossing `chrome.runtime` is JSON-safe (strings/numbers only).
- IndexedDB transactions complete before returning and Blobs survive the round trip.
- Service-worker suspension cannot lose an active session or duplicate a capture.
- `chrome.downloads` filenames are safe, unique, and create the intended folders.
- Popup and preview accessibility: focus rings, labels, disabled states, empty states.
- UI does not use gradients, glow, layout animation, or motion without reduced-motion.

---

## Task 1: Scaffold, build pipeline, manifest, and shells

### Files

- `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`
- `scripts/build.mjs`, `scripts/check-build.mjs`
- `manifest.json`
- `src/background.ts`, `src/content.ts` (minimal placeholders for now)
- `src/popup/popup.html`, `src/preview/preview.html`, their CSS entry stubs
- `src/styles/tokens.css`, `src/styles/base.css`
- `public/icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
- `tests/manifest.test.ts`
- `README.md` (PDF24 link correction only in this task)

### Steps

1. Write `tests/manifest.test.ts` asserting:
   - `manifest_version === 3`
   - `background.service_worker === "background.js"` and `type === "module"`
   - `action.default_popup === "popup.html"`
   - `content_scripts[0].js` contains `"content.js"` and matches
     `https://docs.google.com/presentation/*`
   - permissions include `tabs`, `scripting`, `downloads`, `storage`
   - every icon path and source shell referenced by the test exists
   Run: `npx vitest run tests/manifest.test.ts`
   Expected: FAIL because `manifest.json` does not exist yet.

2. Create `package.json` with scripts:
   `build`, `watch`, `typecheck`, `test`, `check`, and dev dependencies:
   `@types/chrome`, `esbuild`, `jsdom`, `typescript`, `vitest`, `fake-indexeddb`.
   Run: `npm install`
   Expected: install completes and creates `package-lock.json`.

3. Create `tsconfig.json` (strict, ES2022, DOM, Bundler resolution, noEmit),
   `vitest.config.ts` (jsdom, `tests/setup.ts`), and `tests/setup.ts`
   (`import "fake-indexeddb/auto"`).

4. Create `manifest.json` exactly as described in the spec. Create the minimal
   `src/background.ts` and `src/content.ts` shells.

5. Create `scripts/build.mjs`: clean `dist/`, bundle `background.ts` (ESM),
   `content.ts` (IIFE), popup and preview TS (ESM), bundle the two CSS entry points,
   copy `manifest.json`, HTML, and `public/icons`.
   Create `scripts/check-build.mjs`: verify every manifest-referenced output exists.

6. Generate the four PNG icons with PowerShell `System.Drawing` (solid indigo rounded
   square, white slide glyph; no gradients). Save into `public/icons/`.

7. Create the popup and preview HTML/CSS shells with the shared design tokens.
   No gradients, one indigo accent, system fonts, light/dark tokens.

8. Run `npm run build`
   Expected: `dist/` contains `manifest.json`, `background.js`, `content.js`,
   `popup.html`, `popup.js`, `popup.css`, `preview.html`, `preview.js`,
   `preview.css`, and `icons/icon128.png`.

9. Run `node scripts/check-build.mjs`
   Expected: prints `build check passed` and exits 0.

10. Run `npm run typecheck`
    Expected: exits 0 with no diagnostics.

11. Run `npm test`
    Expected: all tests pass, including `tests/manifest.test.ts`.

12. Update `README.md` Option A to link
    `https://tools.pdf24.org/en/merge-pdf` and note that it accepts images.

13. Commit: `feat: scaffold MV3 slides capture extension`

### Completion contract

- The manifest test failed before `manifest.json` existed and passes now.
- `npm run build`, `node scripts/check-build.mjs`, `npm run typecheck`, and `npm test`
  all pass with output read.
- Commit exists.

---

## Task 2: Shared utilities and capture engine

### Files

- `src/shared/types.ts`, `src/shared/constants.ts`, `src/shared/utils.ts`
- `src/capture/selectors.ts`, `src/capture/advance-slide.ts`,
  `src/capture/capture-slide.ts`, `src/capture/run-capture.ts`
- `tests/utils.test.ts`, `tests/advance-slide.test.ts`,
  `tests/capture-slide.test.ts`, `tests/run-capture.test.ts`

### Steps

1. Write `tests/utils.test.ts` covering:
   - `isSlidesPresentationUrl` accepts `.../d/e/ID/pub`, `.../pubembed`, and
     `.../present`; rejects the editor, other hosts, and malformed URLs.
   - `formatSlideFilename(1) === "Slide_001.png"` and `formatSlideFilename(1234)`
     pads to at least 3 digits.
   - `parseTotalSlides` reads `[aria-setsize]`, falls back to "3 of 12" caption text,
     and returns `null` when absent.
   - `getSlideSignature` changes when the caption or SVG content changes.
   - `sanitizeFilenamePart` removes path separators and reserved characters.
   - `buildSlideDownloadPath("My Deck", "Slide_001.png") ===
     "Slides/My Deck/Slide_001.png"`.
   Run: `npx vitest run tests/utils.test.ts`
   Expected: FAIL because the modules do not exist.

2. Implement `types.ts`, `constants.ts`, and `utils.ts` minimally to pass.
   Run the same command.
   Expected: PASS.

3. Write `tests/advance-slide.test.ts` with jsdom. Attach listeners that mutate the SVG
   text after a click, keydown, or wheel. Assert:
   - a click that changes the signature returns true and later strategies are not fired;
   - when click does nothing, ArrowRight that changes the signature returns true;
   - when click and keydown do nothing, wheel that changes the signature returns true;
   - when nothing changes, it returns false after all strategies.
   Use a fake `sleep` that resolves immediately.
   Run: `npx vitest run tests/advance-slide.test.ts`
   Expected: FAIL because `advance-slide.ts` does not exist.

4. Implement `advance-slide.ts` with the existing three-strategy ladder and default
   timings 600/600/600 ms; accept injected `sleep` and `TIming` overrides.
   Run: PASS.

5. Write `tests/capture-slide.test.ts` with jsdom. Build an SVG with an `<image href>`
   and a known width/height. Inject:
   - `fetchImage` returning a fake Blob/data URL string;
   - `rasterize` returning `{dataUrl: "data:image/png;base64,AAA", width, height}`.
   Assert it inlines the image, removes `xlink:href`, passes the serialized SVG to
   `rasterize`, and returns `{ok:true, ...}`. Add a test where `rasterize` throws and
   the result is `{ok:false, reason}`.
   Run: FAIL.

6. Implement `capture-slide.ts` with `captureSlide(doc, deps)` and a real
   `rasterizeSvgElement` wrapper. Use `Promise.allSettled` for sub-images.
   Run: PASS.

7. Write `tests/run-capture.test.ts` covering:
   - `aria-setsize="3"`: captures indexes 1,2,3, advances twice, returns
     `{total:3,captured:3,failed:[],reachedEnd:false}`.
   - one capture failure at index 2 is recorded and the run continues.
   - `advance` returning false stops after the current slide and sets `reachedEnd`.
   - `onSlide` rejection is returned as `error` with partial counts.
   - `isCancelled` stops and sets `cancelled`.
   - a missing total falls back to `maxSlides` but stops when advance fails.
   Run: FAIL.

8. Implement `run-capture.ts`. Progress is emitted before each capture and after each
   capture; `settleMs` runs only when advancing.
   Run: PASS.

9. Run `npm run typecheck` and `npm test`.
   Expected: both pass.

10. Commit: `feat: add capture engine and shared utilities`

### Completion contract

- Each test was watched failing for the missing behavior before implementation.
- `npm test` and `npm run typecheck` pass.
- Commit exists.

---

## Task 3: IndexedDB store, background worker, content controller

### Files

- `src/shared/session-store.ts`, `src/shared/messages.ts`
- `src/background/controller.ts`, `src/background.ts`
- `src/content/controller.ts`, `src/content.ts`
- `tests/session-store.test.ts`, `tests/background-controller.test.ts`,
  `tests/content-controller.test.ts`

### Steps

1. Write `tests/session-store.test.ts` with `fake-indexeddb`:
   - open creates version 1 and both stores;
   - create/get/update session;
   - put two slides out of order, `getSlides` returns index order 1 then 2;
   - `countSlides` counts only that session;
   - deleting a session removes its slides.
   Run: FAIL because `session-store.ts` does not exist.

2. Implement `session-store.ts` with request/transaction promise helpers.
   Run: PASS.

3. Write `tests/background-controller.test.ts` with fake APIs:
   - rejects unsupported URL;
   - rejects a second active capture for the same tab;
   - starts a supported capture, creates the session, focuses the tab, sends
     `RUN_CAPTURE`, sets the badge, and returns `{ok:true, sessionId}`;
   - when `tabs.sendMessage` rejects once, calls `scripting.executeScript` and retries;
   - `handleSlide` converts a PNG data URL to a Blob, stores it, updates the session,
     and sets the badge;
   - `handleComplete` marks the session complete, clears the active key, and opens
     `preview.html?session=<id>`;
   - `handleError` marks the session error and opens the preview with partial slides.
   Run: FAIL.

4. Implement `messages.ts` and `background/controller.ts` with narrow dependency
   interfaces. Use `chrome.storage.session` for `active:<tabId>`.
   Run: PASS.

5. Write `tests/content-controller.test.ts`:
   - `RUN_CAPTURE` while running returns `{ok:false,error:"already-running"}`;
   - a successful run sends `CAPTURE_PROGRESS`, then `CAPTURE_SLIDE` per slide, then
     `CAPTURE_COMPLETE`;
   - a summary with `error` sends `CAPTURE_ERROR`;
   - a rejected `CAPTURE_SLIDE` ack aborts and reports an error.
   Inject a fake `runCapture` implementation so the test does not touch Google Slides.
   Run: FAIL.

6. Implement `content/controller.ts` and the real `content.ts` entry. The entry wires
   `captureSlide(document, ...)`, `advanceSingleSlide(document, sleep)`, and
   `chrome.runtime.sendMessage`.
   Run: PASS.

7. Replace the placeholder `background.ts` with the real entry:
   open the store, create the controller, register `chrome.runtime.onMessage`, and
   respond asynchronously with `return true`.
   Run: PASS.

8. Run `npm run typecheck` and `npm test`.
   Expected: pass.

9. Commit: `feat: add capture orchestration and storage`

### Completion contract

- Store tests use real IndexedDB via `fake-indexeddb`.
- Message payloads in tests contain no Blob; only strings/numbers/arrays.
- `npm run typecheck` and `npm test` pass.
- Commit exists.

---

## Task 4: Preview tab UI and downloads

### Files

- `src/preview/model.ts`, `src/preview/render.ts`, `src/preview/downloads.ts`,
  `src/preview/demo.ts`, `src/preview/preview.ts`
- `src/preview/preview.html`, `src/preview/preview.css`
- `tests/preview-model.test.ts`, `tests/preview-render.test.ts`,
  `tests/downloads.test.ts`

### Steps

1. Write `tests/preview-model.test.ts`:
   - builds title, subtitle, captured time, count, failed labels;
   - maps slides to cards with `Slide_001.png` and folder path;
   - handles a null/empty session with `isEmpty`.
   Run: FAIL.

2. Implement `model.ts`. Run: PASS.

3. Write `tests/preview-render.test.ts` in jsdom:
   - renders the deck title and both primary actions;
   - renders one card per slide with an accessible icon-button label
     (`Download Slide 1`);
   - renders failed slide numbers in the partial state;
   - renders an empty state with one clear action when there are no slides;
   - the demo model renders six cards.
   Run: FAIL.

4. Implement `render.ts` with safe `textContent`/`createElement` construction and
   inline SVG icons using `currentColor`. Run: PASS.

5. Write `tests/downloads.test.ts` with fake `chrome.downloads.download`:
   - one slide downloads to `Slides/<deck>/Slide_001.png` with
     `conflictAction: "uniquify"` and `saveAs: false`;
   - download-all calls downloads in index order;
   - download-all-then-merge awaits downloads, waits, then opens
     `https://tools.pdf24.org/en/merge-pdf`.
   Run: FAIL.

6. Implement `downloads.ts`. Run: PASS.

7. Implement `preview.ts`:
   - read `?session=`;
   - open the store, load session and slides;
   - create object URLs once and revoke on `pagehide`;
   - render, wire handlers, show a busy/success/error status;
   - support `?demo=1` with generated SVG slide blobs.
   Implement `preview.html`/`preview.css` with the final visual system.

8. Run `npm run typecheck` and `npm test`.
   Expected: pass.

9. Commit: `feat: add preview tab and downloads`

### Completion contract

- Render tests assert text and accessible names, not snapshots.
- Download tests assert filenames and ordering.
- `npm run typecheck` and `npm test` pass.
- Commit exists.

---

## Task 5: Popup UI and start flow

### Files

- `src/popup/popup.ts`, `src/popup/popup.html`, `src/popup/popup.css`
- `tests/popup.test.ts`

### Steps

1. Write `tests/popup.test.ts` in jsdom:
   - supported tab renders the ready state and enables Start;
   - unsupported tab disables Start and explains `/pub`, `/pubembed`, `/embed`, or `/preview`;
   - a `START_CAPTURE` rejection shows the error next to the button;
   - a successful start calls `window.close`;
   - the demo state renders without `chrome`.
   Run: FAIL.

2. Implement `popup.ts` with an injected environment interface so the test can pass
   fake `chrome.tabs.query`, `chrome.runtime.sendMessage`, and `close`.
   Implement `popup.html`/`popup.css` with the final visual system.

3. Run `npm run typecheck` and `npm test`.
   Expected: pass.

4. Commit: `feat: add capture popup`

### Completion contract

- The Start button is a real `<button>` with a disabled state and visible focus.
- Errors are rendered next to the action.
- `npm run typecheck` and `npm test` pass.
- Commit exists.

---

## Task 6: README, demo visual QA, final build

### Files

- `README.md`
- `src/preview/demo.ts` polish
- `tests/demo.test.ts`
- `public/icons/*` final art
- `dist/` generated (not committed)

### Steps

1. Write `tests/demo.test.ts` asserting six demo slides with stable filenames and
   non-empty SVG blobs.
   Run: FAIL.
2. Finish `demo.ts` and run: PASS.
3. Rewrite `README.md`:
   - Extension overview, build, load unpacked instructions.
   - Usage: open `/pub`, `/pubembed`, `/embed`, or `/preview`, click the icon, Start Capture.
   - Preview actions and the PDF24 merge note (it accepts images).
   - Permissions and privacy.
   - Legacy console script section pointing at `downloadAsPNG.js`.
   - Troubleshooting: slides tab focus, partial captures, PDF24 upload.
4. Run `npm run check` (typecheck + test + build) and `node scripts/check-build.mjs`.
   Expected: all pass; build outputs present.
5. Start a local static server for `dist/` and use the Playwright browser to screenshot
   `popup.html?demo=1` and `preview.html?demo=1` at 360 px and 1280 px widths.
   Expected: both screens render; no overlap; Start Capture and both download actions
   are visible; download icon buttons have labels; no console errors.
6. Commit: `docs: document extension workflow and verify build`

### Completion contract

- `npm run check` and the build check pass.
- Screenshots were taken and inspected.
- README documents the extension, not only the console script.
- Commit exists.

---

## Final Review

After Task 6, run the whole-branch review with a fresh reviewer against the package
from the merge base. Re-grade findings, fix Critical/Important in one TDD pass, ledger
Minors, and finish with `superpowers:finishing-a-development-branch`.
