# Contributing to Slides Capture

Thanks for helping improve Slides Capture. Bug reports, feature suggestions, documentation
fixes, and code changes are all welcome.

## Ways to contribute

- **Report a bug:** open an issue with the repository's bug report template. Include the
  Chrome version, extension version, whether the deck is `/pub`, `/pubembed`, `/embed`,
  `/preview`, or `/present`, and any errors from the presentation tab console or the
  extension service worker.
- **Suggest a feature:** open an issue describing the workflow you want and what currently
  makes it hard.
- **Fix code or docs:** follow the setup and pull request steps below.

Please do not post private presentation IDs, confidential slide content, or personal data in
issues or pull requests. Public or anonymized examples are best.

## Development setup

Requirements: Node.js 20 or newer and Chrome 116 or newer.

```bash
git clone https://github.com/Wakype/Google-Slide-Downloader.git
cd Google-Slide-Downloader
npm install
npm run check
```

Build the extension and load it as an unpacked extension:

```bash
npm run build
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the generated `dist/` folder.
4. Reload the extension after each rebuild.

`npm run watch` rebuilds on changes. The default build includes source maps for debugging;
release packages are built without them.

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | Bundle the extension into `dist/` with source maps. |
| `npm run watch` | Rebuild on source changes. |
| `npm test` | Run the Vitest + jsdom + fake-indexeddb suite. |
| `npm run typecheck` | Run `tsc --noEmit`. |
| `npm run check` | Typecheck, tests, and build. Run this before opening a PR. |
| `npm run package` | Build without source maps and write the release ZIP. Maintainers use this for releases. |

## Project structure

```text
manifest.json          Manifest V3 configuration
src/background.ts      Service worker entry: session lifecycle, badge, preview opening
src/content.ts         Content script entry and injected runtime guard
src/capture/           Google Slides selectors, slide capture, advance/reset, run loop
src/preview/           Preview page, lightbox, downloads, demo mode
src/popup/             Toolbar popup UI and capture scope
src/shared/            Types, messages, constants, IndexedDB, icons, utilities
tests/                 Vitest suites
```

## Ground rules

- **TypeScript strict mode.** Keep `npm run typecheck` clean.
- **No framework runtime.** The popup and preview use small DOM helpers and CSS; keep it
  that way unless there is a strong reason to change it.
- **Keep Google Slides assumptions in one place.** Selectors and the advance/reset behavior
  belong in `src/capture/`.
- **Runtime messages must be JSON-safe.** Do not send `Blob`, `Error`, `undefined`, or class
  instances through `chrome.runtime`. Send strings, numbers, booleans, arrays, or null.
- **Store slides as Blobs in IndexedDB.** Do not accumulate a whole deck in one message or in
  memory; write one slide at a time.
- **Keep the slides tab focused during capture.** Opening the preview early backgrounds the
  tab and throttles the viewer.
- **Add tests.** New behavior needs a test that fails first. Use dependency injection for
  Chrome APIs, timers, UUIDs, and object URLs so tests do not need a browser.
- **Respect the UI system.** One accent color, no gradients or glow, visible focus rings,
  accessible names, and `prefers-reduced-motion` support.
- **Do not commit generated output.** `dist/`, `release/`, and `node_modules/` are ignored.
- **Do not bump the version in a feature PR.** Maintainers handle release versions and tags.

## Pull requests

1. Branch from `main`.
2. Keep the change focused; separate refactors from behavior changes.
3. Add or update tests.
4. Run `npm run check`.
5. Open a PR describing the behavior change, the user-visible effect, and the validation you
   ran. Link related issues.
6. Use a conventional commit subject such as `feat:`, `fix:`, `docs:`, or `test:`.

If a change affects the Google Slides viewer DOM, note that the viewer is undocumented and
can change. Include the exact finding/anchor URL behavior you tested (without private data).

## License

By contributing, you agree that your contributions are licensed under the repository's MIT
license (see `LICENSE`).
