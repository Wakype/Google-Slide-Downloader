import { TIMING } from "../shared/constants";
import { getCurrentSlide } from "../shared/utils";

export interface ResetSlideOptions {
  sleep?: (ms: number) => Promise<void>;
  checkMs?: number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function dispatchKey(
  doc: Document,
  key: string,
  code: string,
  keyCode: number,
): void {
  const params: KeyboardEventInit = {
    key,
    code,
    keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true,
  };
  doc.dispatchEvent(new KeyboardEvent("keydown", params));
  doc.body?.dispatchEvent(new KeyboardEvent("keydown", params));
}

export async function resetToFirstSlide(
  doc: Document,
  options: ResetSlideOptions = {},
): Promise<boolean> {
  const sleep = options.sleep ?? defaultSleep;
  const checkMs = options.checkMs ?? TIMING.advanceCheckMs;
  const initial = getCurrentSlide(doc);

  if (initial === 1) return true;

  dispatchKey(doc, "Home", "Home", 36);
  await sleep(checkMs);
  if (getCurrentSlide(doc) === 1) return true;
  if (initial === null) return false;

  const previous = doc.querySelector(".punch-viewer-navbar-prev");
  const navCheckMs = Math.min(checkMs, 250);

  for (let attempt = 0; attempt < Math.min(initial, 100); attempt += 1) {
    if (getCurrentSlide(doc) === 1) return true;

    if (
      previous instanceof HTMLElement &&
      !previous.classList.contains("goog-flat-button-disabled")
    ) {
      previous.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    } else {
      dispatchKey(doc, "ArrowLeft", "ArrowLeft", 37);
    }

    await sleep(navCheckMs);
  }

  return getCurrentSlide(doc) === 1;
}
