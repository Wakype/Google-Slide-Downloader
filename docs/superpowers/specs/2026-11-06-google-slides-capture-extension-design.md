# Slides Capture Chrome Extension — Design

Date: 2026-11-06
Status: Approved for execution by the user's `executing-plans` handoff (see ledger ruling).

## Intent

Turn the `downloadAsPNG.js` console script into a Chrome Manifest V3 extension that
captures a published or embedded Google Slides deck as native-resolution PNGs, shows
the result in a preview tab, and makes downloading and PDF merging one click away.

The console workflow is fragile: it requires DevTools, triggers Chrome's multiple-download
prompt, leaves loose files in the Downloads folder, and gives no progress or recovery.
The extension keeps the proven capture algorithm but moves orchestration, progress,
storage, and delivery into proper extension surfaces.

## Goals

- Start a capture from the toolbar popup with one click.
- Capture every slide in a published/embedded Google Slides viewer at native resolution.
- Keep the Google Slides tab focused during capture so Chromium does not throttle it.
- Store captures as Blobs in IndexedDB, not in one giant runtime message.
- Open a preview tab when capture ends, including partial/error results.
- Offer Download all, Download this slide, and Download all + Merge PDF (opens PDF24).
- Use typed TypeScript, a typed runtime message protocol, and modern MV3 APIs.
- Ship a clean, accessible, modern popup and preview UI with no framework runtime.

## Non-goals

- Editing, creating, or converting PPTX/PDF files inside the extension.
- Private Google Slides editor pages with a different DOM. Capture targets the viewer
  used by `/pub`, `/pubembed`, `/present`, `/embed`, and `/preview`.
- OCR, speaker notes, animations, or video export.
- Cloud upload, analytics, telemetry, or any server component.
- Pre-filling the PDF24 upload. A browser cannot attach local files to a third-party
  page; the user selects the downloaded PNGs in PDF24.

## Anti-goals

- Never auto-download every PNG through page `<a download>` clicks, which triggers
  Chrome's multiple-file download prompt.
- Never open the preview tab during capture; that backgrounds the slides tab and
  throttles timers, canvas work, and slide transitions.
- Never let one failed sub-image or one unreadable slide abort the whole deck.
- Never depend on the Google Slides DOM outside one small, documented selector module.

## Constraints

- Manifest V3 service workers can be suspended between events. Durable state lives in
  IndexedDB; in-flight tab ownership lives in `chrome.storage.session`.
- Content scripts run in an isolated world. They share the DOM but not page JavaScript
  objects. The capture algorithm only needs DOM APIs, so the isolated world is enough.
- `chrome.runtime` messages are JSON-serialized. Blobs cannot cross directly; the content
  script sends a PNG data URL per slide and the service worker converts it to a Blob.
- A 60-slide 1920x1080 deck can be hundreds of megabytes. Slides are written to
  IndexedDB one at a time instead of being accumulated in memory or in one message.
- Google Slides' viewer DOM is undocumented and can change. All selectors and the
  advance ladder live in `src/capture/selectors.ts` and `src/capture/advance-slide.ts`.
- The service worker fetches no remote code. The only requests are for slide image
  assets already referenced by the page.
- Chrome does not allow a page to populate a file input on another origin. PDF24 opens
  after the downloads start and the user adds the files there.

## Approaches considered

### A. Vite + CRXJS + React

Pros: HMR, component model, familiar ecosystem.
Cons: CRXJS is still a beta plugin, React adds a runtime and state layer for two small
screens, and MV3 output paths become a plugin concern. Rejected for this surface area.

### B. esbuild + vanilla TypeScript + CSS — chosen

Pros: four deterministic entry points (`background`, `content`, `popup`, `preview`),
a real checked-in `manifest.json`, no plugin compatibility risk, tiny output, and the
build is a readable script. `tsc --noEmit` owns type checking; Vitest owns tests.
Cons: no HMR; use `npm run watch` and reload the extension.
This is the right trade for a small, long-lived utility extension.

### C. WXT framework

Pros: extension-aware conventions, HMR, manifest generation.
Cons: hides the manifest the user explicitly asked to see, adds framework lock-in and
more concepts than the project needs. Rejected.

## Architecture

```
popup.html/ts ──START_CAPTURE──▶ background.ts
                                   │  validates tab
                                   │  creates session in IndexedDB
                                   │  focuses slides tab
                                   ▼
                         content.ts (docs.google.com)
                                   │  capture/advance loop
                                   ├──CAPTURE_PROGRESS──▶ background (badge)
                                   ├──CAPTURE_SLIDE─────▶ background (Blob → IndexedDB)
                                   └──CAPTURE_COMPLETE──▶ background
                                                             │ opens
                                                             ▼
                                                    preview.html/ts
                                                             │ reads IndexedDB
                                                             │ chrome.downloads
                                                             └ opens PDF24 merge
```

### Components

- **Popup**: detects the active tab, explains whether it is supported, starts capture,
  and closes. Progress is shown on the toolbar badge because the popup cannot remain open.
- **Background service worker**: validates the tab, owns the session lifecycle, converts
  data URLs to Blobs, writes slides to IndexedDB, updates the badge, and opens preview.
- **Content script**: runs the capture loop against the viewer DOM. It is the only code
  that knows Google Slides selectors. It sends one message per slide and awaits the ack.
- **Preview page**: reads the session from IndexedDB, renders a responsive thumbnail grid,
  downloads individual or all slides with `chrome.downloads`, and opens PDF24.
- **Shared modules**: message types, data types, constants, IndexedDB store, URL and
  filename utilities, and the capture engine.

## Data model

IndexedDB database `slides-capture` version 1.

`session` store (key path `id`):

```ts
interface CaptureSession {
  id: string;
  tabId: number;
  sourceUrl: string;
  title: string;
  createdAt: number;
  total: number | null;
  captured: number;
  failed: number[];
  status: "capturing" | "complete" | "error";
  error: string | null;
  reachedEnd: boolean;
}
```

`slides` store (key path `id`, index `sessionId`):

```ts
interface SlideRecord {
  id: string;          // `${sessionId}:${index}`
  sessionId: string;
  index: number;       // 1-based
  filename: string;    // Slide_001.png
  blob: Blob;          // PNG
  width: number;
  height: number;
}
```

The preview page opens the same database from the extension origin.

## Capture algorithm

1. Read the expected slide count from `[aria-setsize]`, then from the viewer caption
   text ("3 of 20"), else `null`. `null` means "walk until advancing fails", capped at
   `MAX_SLIDES` (500).
2. For each slide index:
   - Snapshot the viewer signature (caption + SVG text/hash) before advancing.
   - Clone the current SVG, inline every non-data `<image>` as a data URL, serialize,
     draw to a canvas at native width/height, and export PNG.
   - Send the data URL to the worker. Continue even if one slide fails; record its index.
   - If this was the last expected slide, stop.
   - Advance with the existing three-strategy ladder: overlay pointer sequence, document
     ArrowRight, wheel. Wait 600 ms after each strategy and compare signatures. Retry the
     whole ladder up to 3 times with 500 ms between attempts.
   - If no strategy moved the deck, treat it as end of presentation and stop.
   - Wait 800 ms for render stabilization before the next capture.
3. Report a summary: total, captured, failed indexes, reachedEnd, cancelled, error.

All timing values are constants so they can be tuned after testing against a live deck.

## UI

### Popup (360 px wide)

- Product mark, title, and a one-line promise.
- Status pill: supported deck, unsupported page, or checking.
- Primary button: **Start Capture** with a slide icon.
- Helper line: keep the presentation tab visible; capture takes about a second per slide.
- Inline error next to the button when start fails.
- A restrained footer: "PNG capture · PDF24 merge".

### Preview tab

- Top bar: product mark, deck title, source host, captured time.
- Summary row: slide count, failed count, capture status.
- Actions: **Download all**, **Download all + Merge PDF**, and a note that PDF24 opens
  after downloads start.
- Responsive grid of 16:9 cards. Each card shows the thumbnail, `Slide_001.png`,
  dimensions, and a download icon button with an accessible label.
- Empty state when no slides were captured, with a clear next action.
- Partial/error state shows failed slide numbers without hiding successful slides.
- A `?demo=1` mode renders six generated SVG slides for visual QA without Chrome APIs.

### Visual system

- One accent color (indigo). No gradients, no glow, no decorative animation.
- System font stack, `text-wrap: balance` on headings, `text-wrap: pretty` on body.
- 4/8/12/16/24/32 spacing scale, 10 px control radius, 16 px card radius.
- Light and dark via `prefers-color-scheme`, using CSS custom properties.
- Borders are structural; elevation uses layered transparent shadows. Focus rings are
  visible and keyboard-only. Icon-only buttons have `aria-label`.
- Motion is limited to `opacity`/`transform` transitions under 200 ms, gated by
  `prefers-reduced-motion`; state is always also carried by color, icon, or label.

## Permissions

- `tabs` — query the active tab, focus it, read title/URL, open preview.
- `scripting` — inject the content script into tabs that were open before the extension.
- `downloads` — save PNGs without the page-level multiple-download prompt.
- `storage` — `chrome.storage.session` for in-flight capture ownership.
- Host permission `https://docs.google.com/presentation/*` — content script and injection.
- No `activeTab`, no `<all_urls>`, no remote code.

## Error handling

- **Unsupported page**: popup disables Start and explains the supported URLs.
- **Already capturing**: `chrome.storage.session` guard rejects a second session per tab.
- **Content script missing**: worker injects `content.js` once, then retries the message.
- **Slide capture failure**: record the index, continue; preview shows partial results.
- **Advance failure**: stop, mark `reachedEnd`, keep captured slides.
- **Worker restart**: all durable state is in IndexedDB; a new start checks session storage.
- **Storage failure**: abort the run, mark the session `error`, open the preview with what
  was stored.
- **No slides captured**: preview shows an empty state with instructions, not a broken grid.
- **Preview loaded without a session id**: empty state with a "Close tab" action.

## Security and privacy

- The extension only runs on `docs.google.com/presentation/*`.
- No analytics, no external API calls, no remote code.
- Slide assets are fetched from URLs already present in the page's SVG.
- PDF24 is opened only after an explicit button click; the extension sends no files.
- Session data stays in the extension's IndexedDB. The user can clear it by clearing
  extension data or deleting the extension.

## Testing strategy

- Vitest + jsdom for DOM utilities, the capture loop, renderers, and message handlers.
- `fake-indexeddb` for the session store.
- Dependency injection for Chrome APIs, sleep, UUID, fetch, and object URLs so tests
  assert behavior without a browser.
- A build check verifies `dist/manifest.json` references files that exist.
- `?demo=1` in the preview plus the popup demo state support Playwright screenshots.
- Manual check: load `dist/` as an unpacked extension against a published deck.

## What is left to the builder

- Validate the selector set and advance ladder against the current Google Slides viewer;
  adjust timing constants if a real deck skips or stalls.
- Replace the generated placeholder icons with final art if desired.
- Decide whether to publish to the Chrome Web Store (store listing, screenshots, review).
