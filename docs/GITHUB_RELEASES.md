# Publishing with GitHub Releases

GitHub Releases is the primary distribution path for Slides Capture. It requires no paid
developer account and lets users install the prebuilt extension as an unpacked Chrome
extension.

## Build the release asset

```bash
npm install
npm run check
npm run package
```

`npm run package` builds without source maps and writes:

```text
release/slides-capture-<version>.zip
```

The ZIP root contains `manifest.json`, `background.js`, `content.js`, `popup.html`,
`preview.html`, the CSS/JS bundles, and `icons/`.

Create a checksum:

```powershell
$hash = (Get-FileHash "release\slides-capture-1.0.0.zip" -Algorithm SHA256).Hash.ToLower()
"$hash  slides-capture-1.0.0.zip" |
  Set-Content "release\slides-capture-1.0.0.zip.sha256" -Encoding ASCII
```

## Publish the release

Use a version that matches `manifest.json`:

```bash
gh release create v1.0.0 \
  "release/slides-capture-1.0.0.zip" \
  "release/slides-capture-1.0.0.zip.sha256" \
  --target main \
  --title "Slides Capture v1.0.0" \
  --notes-file release-notes.md
```

On Windows PowerShell, the same command can be run with backtick line continuations or on a
single line. `release-notes.md` should include:

- the feature summary,
- the install steps below,
- the checksum,
- the privacy policy link (`PRIVACY.md`),
- known limitations: live Google Slides DOM can change, Chrome may ask once to allow
  multiple downloads, PDF24 is an external handoff, and the build is unsigned.

## Install from a release

1. Open the repository's **Releases** page.
2. Download `slides-capture-<version>.zip` from **Assets**.
3. Extract it to a permanent folder.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Click **Load unpacked** and select the extracted folder.
7. Pin **Slides Capture** to the toolbar.

Chrome may show the standard developer-mode extension warning. The release is not signed by
the Chrome Web Store.

## Updates

1. Change `version` in `manifest.json` (for example `1.0.1`).
2. Run `npm run check` and `npm run package`.
3. Create a new release tag and upload the new ZIP and checksum.
4. Users download the new ZIP, replace the old extracted folder, and reload the extension at
   `chrome://extensions`.
