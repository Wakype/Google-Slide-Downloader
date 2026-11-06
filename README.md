# Slides Capture

A Chrome extension that captures published or embedded Google Slides as native-resolution
PNGs, previews them in a tab, and makes downloading or merging them into a PDF one click
away.

The original DevTools console script is still included as `downloadAsPNG.js` for legacy
use, but the extension is the recommended workflow.

## Features

- One-click capture from the toolbar popup.
- Captures `/pub`, `/pubembed`, `/present`, `/embed`, and `/preview` Google Slides viewers.
- Streams each slide to the extension worker as it is captured, so large decks do not
  sit in memory or in one giant message.
- Progress on the toolbar badge (`12/40`), so the presentation tab can stay focused.
- Preview tab with a responsive thumbnail grid.
- Click any slide to open a full-size lightbox with previous/next controls and a download button.
- **Download all**, per-slide download buttons, and **Download all + Merge PDF**.
- Report button in the preview header opens the GitHub bug-report template.
- PDF24's Merge PDF page accepts PNG images directly and converts them into one PDF.
- Typed TypeScript, Manifest V3, IndexedDB storage, and no remote code.

## Requirements

- Chrome 116 or newer.
- Node.js 20 or newer for building from source.
- A Google Slides presentation published with **File → Share → Publish to web**
  (`/pub`, `/pubembed`, `/embed`, or `/preview`), or opened in the presentation viewer (`/present`).

## Build and load

```bash
npm install
npm run build
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the generated `dist/` folder.
4. Pin **Slides Capture** to the toolbar.

For development, `npm run watch` rebuilds on changes. Reload the extension from
`chrome://extensions` after a rebuild.

## Usage

1. Open a published or embedded presentation:
   ```text
   https://docs.google.com/presentation/d/e/<PRESENTATION_ID>/pub
   ```
2. Click the **Slides Capture** icon and press **Start Capture**.
3. Keep the presentation tab visible. Chromium throttles background tabs, which can slow
   or stall slide transitions. Progress appears on the extension badge.
4. When the capture finishes, a preview tab opens automatically.
5. Use:
   - **Download all** to save every PNG.
   - The download icon on a card to save one slide.
   - **Download all + Merge PDF** to save every PNG, then open
     [PDF24 Merge PDF](https://tools.pdf24.org/en/merge-pdf) in a new tab.
6. Click a slide thumbnail to open the full-size lightbox. Use the arrow buttons or
   Left/Right keys to move between slides, Escape to close, and **Download** in the
   lightbox to save the visible slide.

PDF24 opens after the downloads start. A browser cannot attach local files to another
site, so add the downloaded PNGs in PDF24 and merge them there. PDF24 accepts PNG and JPG
images directly.

Files are named `slide_001.png`, `slide_002.png`, and so on, inside a per-deck folder
under `Downloads/Slides/`.

Use the download icon or the lightbox **Download** button to get that filename. Using the
browser's context menu on a preview image saves the underlying blob URL, which Chrome names
with a UUID instead.

## How it works

```text
popup ──START_CAPTURE──▶ background service worker
                           │ validates the tab
                           │ creates a session in IndexedDB
                           │ focuses the presentation tab
                           ▼
                    content script (Google Slides viewer)
                           │ captures the SVG → canvas → PNG
                           ├── progress ──▶ toolbar badge
                           ├── one PNG per message ──▶ IndexedDB
                           └── complete ──▶ preview tab
                                               │ reads IndexedDB
                                               │ chrome.downloads
                                               └ opens PDF24
```

- The content script is the only code that knows Google Slides selectors.
- Each slide is rasterized at the SVG's native size and sent as a PNG data URL. The worker
  converts it to a Blob and stores it in IndexedDB.
- The preview opens only after the capture ends, so it does not background the presentation
  tab during the run.
- Downloads use `chrome.downloads`, avoiding Chrome's page-level multiple-download prompt.

## Permissions

| Permission | Why |
| --- | --- |
| `tabs` | Read the active tab, focus it, and open the preview. |
| `scripting` | Inject the content script into tabs that were open before the extension loaded. |
| `downloads` | Save PNGs without the multiple-file prompt. |
| `storage` | Track the active capture per tab in `chrome.storage.session`. |
| `https://docs.google.com/presentation/*` | Run the capture content script. |
| `https://docs.google.com/slides-images-rt/*` | Fetch embedded slide images in the worker so they can be inlined before rasterization. |
| `https://*.googleusercontent.com/*` | Fetch Google-hosted slide images in the worker. |

The extension has no analytics, no remote code, and no server. Slide data stays in the
extension's IndexedDB until you clear extension data or remove the extension. PDF24 is
opened only when you press its button, and the extension never uploads files to it.

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # Vitest + jsdom + fake-indexeddb
npm run build       # esbuild bundle in dist/
npm run watch       # rebuild on source changes
npm run check       # typecheck + test + build
```

Visual QA without a Google account:

```bash
npm run serve:dist
```

Then open:

- `http://localhost:4173/popup.html?demo=1`
- `http://localhost:4173/preview.html?demo=1`

The demo preview renders six generated slides and disables downloads.

## Project layout

```text
manifest.json              Manifest V3
scripts/build.mjs          esbuild build
src/background.ts          service worker entry
src/background/            session lifecycle, badge, preview opening
src/content.ts             content script entry
src/content/               capture loop messaging
src/capture/               selectors, slide capture, advance ladder, run loop
src/shared/                types, messages, constants, IndexedDB, utilities, icons
src/popup/                 popup UI
src/preview/               preview UI, downloads, demo mode
tests/                     Vitest suites
docs/superpowers/          design and implementation plan
```

## Troubleshooting

| Issue | Cause | Solution |
| --- | --- | --- |
| **Start Capture is disabled** | The active tab is not a supported Slides viewer. | Open a `/pub`, `/pubembed`, `/present`, `/embed`, or `/preview` URL. |
| **Capture stalls or skips slides** | The presentation tab was backgrounded or the viewer changed. | Keep the tab visible, reload, and try again. |
| **Only some slides appear** | One or more slides failed to rasterize, or the deck ended early. | The preview lists failed slide numbers. Re-run the capture. |
| **Some slides say "Missing images"** | The worker could not fetch an embedded slide image, so that image was removed and the slide was still captured. | Reload the presentation and retry; check the extension's service-worker console for the asset URL. |
| **PDF24 has no files** | The browser cannot pre-fill a third-party upload. | Drag the downloaded PNGs from `Downloads/Slides/` into PDF24. |
| **Content script does not respond** | The tab was open before the extension was installed or reloaded. | Reload the presentation tab, or retry; the worker injects the script automatically. |

## Reporting an issue

Use the flag button in the preview header, or open the
[bug report form](https://github.com/Wakype/Google-Slide-Downloader/issues/new?template=bug_report.yml)
directly. The form asks for the presentation URL (optional), Chrome and extension versions,
reproduction steps, and console errors.

## Legacy console script

`downloadAsPNG.js` still works when pasted into DevTools on a published presentation. It
downloads each PNG through page `<a download>` links, so Chrome may ask for permission to
download multiple files. The extension avoids that prompt and adds preview, progress, and
PDF24 integration.

## Disclaimer

This tool is intended for educational, personal archival, and fair-use reference only.

- Respect copyright and content ownership. Do not scrape, redistribute, or commercially
  exploit presentations without authorization.
- Users are responsible for complying with Google's Terms of Service and applicable
  privacy laws.
- The software is provided "as is", without warranty. The author assumes no liability for
  misuse, rate limiting, or data loss.
