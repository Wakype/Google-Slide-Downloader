# Publishing to the Chrome Web Store (optional)

> GitHub Releases is the primary distribution path and requires no paid developer account.
> This guide is optional and applies only if you decide to pay the Chrome Web Store
> developer registration fee.

This guide assumes the extension builds successfully with `npm run check` and that the
repository is public at `https://github.com/Wakype/Google-Slide-Downloader`.

## 1. Create the store package

```bash
npm install
npm run package
```

`npm run package` builds without source maps and writes:

```text
release/slides-capture-<version>.zip
```

The ZIP root contains `manifest.json`, `background.js`, `content.js`, `popup.html`,
`preview.html`, the CSS/JS bundles, and `icons/`. Do not upload the repository folder or the
`dist/` folder itself; upload the ZIP.

Verify the ZIP before uploading:

```powershell
Expand-Archive release\slides-capture-1.0.0.zip -DestinationPath $env:TEMP\slides-capture-check -Force
Get-ChildItem $env:TEMP\slides-capture-check
```

## 2. One-time developer account

1. Open https://chrome.google.com/webstore/devconsole.
2. Sign in with the Google account that should own the extension.
3. Register as a Chrome Web Store developer (one-time fee, currently US$5).
4. Accept the developer agreement.

## 3. Create and upload the item

1. In the developer dashboard, click **New item**.
2. Upload `release/slides-capture-<version>.zip`.
3. Fix any manifest errors the dashboard reports. The extension uses Manifest V3, a module
   service worker, and no remote code.
4. Set the item name. **Check that "Slides Capture" is available**; Chrome Web Store names
   are global. Do not use Google trademarks or Google logos in the name or listing.
5. Add a short description (up to 132 characters). Suggested:
   > Capture published Google Slides as high-resolution PNGs and send them to PDF24.
6. Add the detailed description. Suggested:

   > Slides Capture turns a published or embedded Google Slides presentation into
   > high-resolution PNG files.
   >
   > - Start a capture from the toolbar popup.
   > - Capture all slides or only the first N slides.
   > - Preview the result in a thumbnail grid with a full-size viewer.
   > - Download all slides, download individual slides, or open PDF24 to merge them into a
   >   PDF.
   > - Keep the presentation tab visible while capturing.
   >
   > The extension is intended for educational, personal archival, and fair-use reference.
   > Respect copyright and Google's Terms of Service. It is not affiliated with Google.
   > Provided as is, without warranty.

7. Choose the category (for example **Productivity**), language, and regions.
8. Set the item to **Free**.

## 4. Graphics and screenshots

Chrome Web Store requires at least one screenshot (1280×800 or 640×400 PNG/JPEG). Capture
the extension's own demo states without a Google account:

```bash
npm run serve:dist
```

Open:

- `http://localhost:4173/preview.html?demo=1` for the preview grid and lightbox.
- `http://localhost:4173/popup.html?demo=1` for the popup.

Use the browser's screenshot tool or Playwright to save 1280×800 screenshots. Suggested
shots:

1. Popup with **All slides** selected.
2. Preview grid with the action buttons.
3. Lightbox with previous/next and Download.
4. Popup with **Some slides** and a count entered.

The 128×128 extension icon is already in `public/icons/icon128.png`. The dashboard may also
ask for a 440×280 promotional tile; it is optional.

## 5. Privacy practices

Complete the **Privacy practices** tab accurately:

- The extension does **not** collect or transmit personal data.
- It stores captured slide images and session metadata locally in IndexedDB.
- It fetches slide image assets from `docs.google.com` and `googleusercontent.com` to render
  the presentation.
- It opens PDF24 only after the user clicks the merge button; it does not upload files.
- It opens GitHub only after the user clicks the report button.
- No analytics, telemetry, ads, or external server.

Use this privacy policy URL (the repository is public):

```text
https://github.com/Wakype/Google-Slide-Downloader/blob/main/PRIVACY.md
```

If the dashboard requires a hosted policy that is not a GitHub page, publish `PRIVACY.md`
on GitHub Pages or another public site and use that URL.

## 6. Permission justifications

Prepare these for the dashboard:

- **tabs** — Read the active tab's URL/title, focus the presentation tab, and open the preview
  tab. The extension does not read browsing history.
- **scripting** — Inject `content.js` into a presentation tab that was already open when the
  extension loaded or was reloaded.
- **storage** — Use `chrome.storage.session` to remember which tab owns an in-flight
  capture.
- **https://docs.google.com/presentation/*** — Run the capture content script only on
  Google Slides presentation pages.
- **https://docs.google.com/slides-images-rt/*** — Fetch embedded slide images referenced by
  the presentation so the worker can inline them before rasterization.
- **https://*.googleusercontent.com/*** — Fetch Google-hosted slide images referenced by the
  presentation.

The extension does not use `downloads`; downloads use the HTML `download` attribute with the
exact `slide_NNN.png` filename. Chrome may ask the user once to allow multiple downloads.

## 7. Distribution and review

1. Choose **Public**, **Unlisted**, or **Private** as appropriate.
2. Submit for review.
3. Respond to any review email promptly. Review time varies; it can take several days.
4. After approval, the item is published. Keep the ZIP and the source tag/commit for the
   submitted version.

## 8. Updates

1. Change `version` in `manifest.json` (for example `1.0.1`).
2. Run `npm run check` and `npm run package`.
3. Upload the new ZIP in the dashboard, update the listing if needed, and submit for review.

## Notes

- The store listing must not claim the extension merges PDFs itself; it hands off to PDF24.
- Do not claim the multiple-download prompt is avoided.
- The extension is not affiliated with Google. Keep the README disclaimer and the store
  listing consistent with `PRIVACY.md`.
- If the extension is rejected for capturing Google Slides content, review the listing and
  permission explanations; the tool is intended for personal/educational archival use.
