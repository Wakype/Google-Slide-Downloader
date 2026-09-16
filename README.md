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
Copy the entire Minified JavaScript snippet below or copy code from `downloadAsPNG.js`, paste it into the console, and press `Enter`:

```javascript
(async()=>{const sleep=ms=>new Promise(res=>setTimeout(res,ms)),getSig=()=>{const e=document.querySelector(".docs-material-menu-button-flat-default-caption")||document.querySelector("[aria-posinset]"),t=e?e.getAttribute("aria-posinset")||e.textContent.trim():"",s=document.querySelector(".punch-viewer-svgpage-svgcontainer svg")||document.querySelector("svg"),n=s?(s.textContent||"").trim().slice(0,80)+"_"+s.innerHTML.length:"";return`${t}::${n}`},nextSlide=async()=>{const prevSig=getSig(),coat=document.querySelector(".punch-viewer-coat")||document.querySelector(".punch-viewer-svgpage-svgcontainer")||document.querySelector(".punch-viewer-container");if(coat){const p={bubbles:!0,cancelable:!0,view:window,clientX:250,clientY:250};coat.dispatchEvent(new MouseEvent("mousedown",p)),coat.dispatchEvent(new MouseEvent("mouseup",p)),coat.dispatchEvent(new MouseEvent("click",p))}if(await sleep(600),getSig()!==prevSig)return!0;const k={key:"ArrowRight",code:"ArrowRight",keyCode:39,which:39,bubbles:!0,cancelable:!0};if(document.dispatchEvent(new KeyboardEvent("keydown",k)),document.body.dispatchEvent(new KeyboardEvent("keydown",k)),await sleep(600),getSig()!==prevSig)return!0;const target=coat||document.body;return target.dispatchEvent(new WheelEvent("wheel",{deltaY:150,bubbles:!0,cancelable:!0})),await sleep(600),getSig()!==prevSig},captureSlide=async idx=>{const container=document.querySelector(".punch-viewer-svgpage-svgcontainer")||document.querySelector("svg");if(!container)return!1;const svg="svg"===container.tagName.toLowerCase()?container:container.querySelector("svg");if(!svg)return!1;const clone=svg.cloneNode(!0),images=clone.querySelectorAll("image");await Promise.all(Array.from(images).map(async img=>{const href=img.getAttribute("xlink:href")||img.getAttribute("href");if(href&&!href.startsWith("data:"))try{const res=await fetch(href),blob=await res.blob(),b64=await new Promise(r=>{const fr=new FileReader;fr.onloadend=()=>r(fr.result),fr.readAsDataURL(blob)});img.removeAttribute("xlink:href"),img.setAttribute("href",b64)}catch(e){console.warn("Sub-image asset skipped:",href)}}));const svgStr=new XMLSerializer().serializeToString(clone),blob=new Blob([svgStr],{type:"image/svg+xml;charset=utf-8"}),url=URL.createObjectURL(blob);return new Promise(res=>{const img=new Image;img.onload=()=>{const canvas=document.createElement("canvas"),w=svg.width?.baseVal?.value||img.naturalWidth||1920,h=svg.height?.baseVal?.value||img.naturalHeight||1080;canvas.width=w,canvas.height=h,canvas.getContext("2d").drawImage(img,0,0,w,h);const a=document.createElement("a");a.download=`Slide_${String(idx).padStart(3,"0")}.png`,a.href=canvas.toDataURL("image/png"),a.click(),URL.revokeObjectURL(url),res(!0)},img.onerror=()=>{URL.revokeObjectURL(url),res(!1)},img.src=url})},sizeEl=document.querySelector("[aria-setsize]"),total=sizeEl?parseInt(sizeEl.getAttribute("aria-setsize"),10):100;console.log(`Starting capture sequence (Detected target slides: ${total})...`);for(let i=1;i<=total;i++){console.log(`[${i}/${total}] Capturing slide...`),await captureSlide(i);if(i>=total){console.log("All available slides captured.");break}console.log(`Advancing to slide ${i+1}...`);let moved=!1;for(let a=1;a<=3;a++)if(moved=await nextSlide(),moved)break;else console.warn(`Slide change attempt ${a} failed, retrying...`),await sleep(500);if(!moved){console.warn(`Slide did not advance past index ${i}. End of presentation reached.`);break}await sleep(800)}console.log("Process completed.")})();
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
