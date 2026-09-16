# Google Slides Embed Downloader

A lightweight client-side script to sequentially capture and export published or embedded Google Slides (`/pubembed` or `/pub`) as high-resolution PNG images directly from your browser DevTools console.

---

## 📌 Overview

Google Slides presentations published via **Publish to the web** (`/pub` or `/pubembed`) disable the standard export menu (`File > Download > PDF/PPTX`). Additionally:
- Slides are rendered dynamically inside an SVG container (`.punch-viewer-svgpage-svgcontainer`).
- Slides outside the active viewport are not kept in the DOM at the same time.
- Standard `.click()` or synthetic keyboard events are often ignored unless dispatched to the active overlay coat (`.punch-viewer-coat`).
- Security policies like **TrustedHTML (Trusted Types)** prevent injecting raw HTML strings into the document.

This script solves these challenges by:
1. Intercepting the active SVG DOM element and embedding external images as base64 Data URLs.
2. Rasterizing each SVG onto an HTML5 Canvas at native resolution.
3. Automatically triggering a client-side download for each slide.
4. Using a cascading fallback navigation trigger to advance slides reliably without skipping or stalling.

---

## 🛠️ Requirements & Browser Settings

Before running the script, ensure the following browser settings are configured:

1. **Allow Automatic Downloads**:
   - When the script downloads the second slide, your browser may show a prompt:  
     > *"This site is attempting to download multiple files. Allow?"*
   - Click **Allow**.
   - If you missed the prompt, go to `chrome://settings/content/automaticDownloads` and add `https://docs.google.com` to the **Allowed** list.
2. **Keep Tab Active & Focused**:
   - Keep the presentation tab visible on your screen. Chromium browsers throttle background tabs (limiting `requestAnimationFrame`, `setTimeout`, and canvas rasterization), which can delay slide transitions.

---

## 📖 Step-by-Step Usage Guide

### Step 1: Open the Presentation in Full View
For optimal layout and navigation controls, change `/pubembed?...` to `/pub` in your URL if possible:
```text
https://docs.google.com/presentation/d/e/<PRESENTATION_ID>/pub?start=false&loop=false&delayms=3000
```
*(The script still functions on `/pubembed`, but `/pub` provides standard viewport dimensions.)*

### Step 2: Open Developer Tools Console
1. Press `F12` or `Ctrl + Shift + I` (Windows/Linux) or `Cmd + Option + I` (macOS).
2. Click on the **Console** tab.

### Step 3: Paste and Execute the Script
Copy the entire JavaScript snippet below or copy code from `downloadAsPNG.js`, paste it into the console, and press `Enter`:

```javascript
// Helper to pause execution
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retrieve unique snapshot signature of current slide
function getSlideSignature() {
  const counterElem = document.querySelector('.docs-material-menu-button-flat-default-caption') ||
                      document.querySelector('[aria-posinset]');
  const counterText = counterElem ? (counterElem.getAttribute('aria-posinset') || counterElem.textContent.trim()) : '';

  const svg = document.querySelector('.punch-viewer-svgpage-svgcontainer svg') || document.querySelector('svg');
  const svgText = svg ? (svg.textContent || '').trim().slice(0, 80) + '_' + svg.innerHTML.length : '';

  return `${counterText}::${svgText}`;
}

// Single step navigation with fallback ladder (executes only one successful trigger)
async function advanceSingleSlide() {
  const initialSig = getSlideSignature();

  // Strategy 1: Dispatch pointer sequence to the overlay coat
  const coat = document.querySelector('.punch-viewer-coat') ||
               document.querySelector('.punch-viewer-svgpage-svgcontainer') ||
               document.querySelector('.punch-viewer-container');

  if (coat) {
    const clickParams = { bubbles: true, cancelable: true, view: window, clientX: 250, clientY: 250 };
    coat.dispatchEvent(new MouseEvent('mousedown', clickParams));
    coat.dispatchEvent(new MouseEvent('mouseup', clickParams));
    coat.dispatchEvent(new MouseEvent('click', clickParams));
  }

  // Check if Strategy 1 succeeded
  await sleep(600);
  if (getSlideSignature() !== initialSig) return true;

  // Strategy 2: Dispatch ArrowRight to document & document.body
  const keyParams = { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39, bubbles: true, cancelable: true };
  document.dispatchEvent(new KeyboardEvent('keydown', keyParams));
  document.body.dispatchEvent(new KeyboardEvent('keydown', keyParams));

  // Check if Strategy 2 succeeded
  await sleep(600);
  if (getSlideSignature() !== initialSig) return true;

  // Strategy 3: Dispatch mouse wheel step
  const target = coat || document.body;
  target.dispatchEvent(new WheelEvent('wheel', { deltaY: 150, bubbles: true, cancelable: true }));

  // Check if Strategy 3 succeeded
  await sleep(600);
  return getSlideSignature() !== initialSig;
}

// Export SVG content to PNG
async function captureCurrentSlide(slideNumber) {
  const svgContainer = document.querySelector('.punch-viewer-svgpage-svgcontainer') ||
                       document.querySelector('svg');
  if (!svgContainer) return false;

  const svg = svgContainer.tagName.toLowerCase() === 'svg' ? svgContainer : svgContainer.querySelector('svg');
  if (!svg) return false;

  const clonedSvg = svg.cloneNode(true);
  const images = clonedSvg.querySelectorAll('image');

  // Convert embedded external assets into Data URLs
  const imagePromises = Array.from(images).map(async (img) => {
    const href = img.getAttribute('xlink:href') || img.getAttribute('href');
    if (!href || href.startsWith('data:')) return;

    try {
      const response = await fetch(href);
      const blob = await response.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
      img.removeAttribute('xlink:href');
      img.setAttribute('href', base64);
    } catch (err) {
      console.warn('Sub-image asset skipped:', href);
    }
  });

  await Promise.all(imagePromises);

  const svgString = new XMLSerializer().serializeToString(clonedSvg);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const width = svg.width?.baseVal?.value || img.naturalWidth || 1920;
      const height = svg.height?.baseVal?.value || img.naturalHeight || 1080;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const downloadLink = document.createElement('a');
      const formattedNumber = String(slideNumber).padStart(3, '0');
      downloadLink.download = `Slide_${formattedNumber}.png`;
      downloadLink.href = canvas.toDataURL('image/png');
      downloadLink.click();

      URL.revokeObjectURL(blobUrl);
      resolve(true);
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      resolve(false);
    };

    img.src = blobUrl;
  });
}

async function startSlideDownloader() {
  const setSizeElem = document.querySelector('[aria-setsize]');
  const totalSlides = setSizeElem ? parseInt(setSizeElem.getAttribute('aria-setsize'), 10) : 100;

  console.log(`Starting capture sequence (Detected target slides: ${totalSlides})...`);

  for (let current = 1; current <= totalSlides; current++) {
    console.log(`[${current}/${totalSlides}] Capturing slide...`);
    await captureCurrentSlide(current);

    if (current >= totalSlides) {
      console.log('All available slides captured.');
      break;
    }

    console.log(`Advancing to slide ${current + 1}...`);
    let moved = false;

    // Retry up to 3 attempts with the cascading trigger
    for (let attempt = 1; attempt <= 3; attempt++) {
      moved = await advanceSingleSlide();
      if (moved) break;
      console.warn(`Slide change attempt ${attempt} failed, retrying...`);
      await sleep(500);
    }

    if (!moved) {
      console.warn(`Slide did not advance past index ${current}. End of presentation reached.`);
      break;
    }

    // Wait for render stabilization before next capture
    await sleep(800);
  }

  console.log('Process completed.');
}

startSlideDownloader();
```

---

## ⚙️ Merging Downloaded PNGs into a Single PDF

Once all images (`Slide_001.png`, `Slide_002.png`, etc.) are downloaded to your `Downloads` folder, you can merge them into a single PDF using one of the following methods:


### Option A: Using Online Tools (Easy Way)
- [PDF24 Tools](https://tools.pdf24.org/en/images-to-pdf)
- Etc.

### Option B: Using ImageMagick
```bash
magick convert Slide_*.png Presentation.pdf
```

### Option C: Using Python (`img2pdf`)
```bash
pip install img2pdf
```
```python
import os
import img2pdf

# Get sorted list of PNG files
images = sorted([f for f in os.listdir('.') if f.startswith('Slide_') and f.endswith('.png')])

with open("Presentation.pdf", "wb") as f:
    f.write(img2pdf.convert(images))

print("Successfully merged into Presentation.pdf")
```

---

## ❓ Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Only Slide 1 downloads** | Browser blocked multi-file download permission. | Look at the right side of the address bar for the download blocked icon and click "Always allow". |
| **Slides skipping or jumping** | Multiple events dispatched simultaneously. | The script uses a waterfall ladder that only fires subsequent events if earlier ones failed. Do not click manually during execution. |
| **Images inside slide are blank** | Cross-Origin or async delay in fetching sub-assets. | Ensure `fetch(href)` and `Promise.all` are allowed. If the deck has heavy images, increase `sleep(800)` to `sleep(1500)`. |
| **TrustedHTML assignment blocked** | Direct injection of `.innerHTML` blocked by CSP. | The script avoids `.innerHTML` injection and uses native DOM cloning and XML serialization. |
