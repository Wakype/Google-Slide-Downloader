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
