# Privacy Policy — Slides Capture

Last updated: 2026-11-06

Slides Capture is a Chrome extension that captures published or embedded Google Slides
presentations as PNG images on the user's own machine. This policy explains what the
extension does with data.

## Data collection and sharing

Slides Capture does **not** collect, transmit, sell, or share personal data. It has no
analytics, telemetry, advertising, accounts, or external server.

## Data processed locally

- When the user presses **Start Capture**, the extension reads the Google Slides presentation
  that is already open in the active tab and renders its slides as PNG images.
- Captured images and session metadata (deck title, source URL, timestamps, slide count,
  warnings) are stored locally in the extension's IndexedDB database.
- The data stays in the browser profile unless the user downloads the images or clears the
  extension's data. Removing the extension removes its stored data.

## Network requests

- The extension fetches slide image assets referenced by the presentation from
  `docs.google.com` and `googleusercontent.com` so the slides can be rendered correctly.
  These requests go directly to Google and are subject to Google's privacy policy.
- **PDF24** is opened in a new tab only when the user presses **Download all + Merge PDF**.
  The extension does not upload any files to PDF24. Files are selected by the user in the
  PDF24 page, and PDF24's own privacy policy applies there.
- The **Report an issue** button opens a GitHub issue form. No data is sent unless the user
  submits the form; GitHub's privacy policy applies there.

## Permissions

- `tabs` — read the active tab's URL/title, focus the presentation, and open the preview.
- `scripting` — inject the content script into presentation tabs that were already open
  before the extension loaded or reloaded.
- `storage` — keep the in-flight capture owner in `chrome.storage.session`.
- Host permissions for `docs.google.com/presentation/*`,
  `docs.google.com/slides-images-rt/*`, and `*.googleusercontent.com/*` — run the capture
  script on the presentation viewer and fetch the slide image assets it references.

## User choices

- The user starts every capture explicitly from the toolbar popup.
- The user chooses whether to open PDF24, whether to submit a GitHub issue, and which files
  to download or upload.
- Clearing the extension's data or removing the extension deletes locally stored captures.

## Contact

Questions or requests: open an issue at
https://github.com/Wakype/Google-Slide-Downloader/issues.

## Changes

If this policy changes, the updated version will be published in this repository with a new
"Last updated" date.
