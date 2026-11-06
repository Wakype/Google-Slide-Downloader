import { TIMING } from "../shared/constants";
import { getSlideSignature } from "../shared/utils";
import { findCoat } from "./selectors";

export interface AdvanceOptions {
  sleep?: (ms: number) => Promise<void>;
  checkMs?: number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function advanceSingleSlide(
  doc: Document,
  options: AdvanceOptions = {},
): Promise<boolean> {
  const sleep = options.sleep ?? defaultSleep;
  const checkMs = options.checkMs ?? TIMING.advanceCheckMs;
  const initialSignature = getSlideSignature(doc);
  const coat = findCoat(doc);

  if (coat) {
    const params: MouseEventInit = {
      bubbles: true,
      cancelable: true,
      clientX: 250,
      clientY: 250,
    };
    coat.dispatchEvent(new MouseEvent("mousedown", params));
    coat.dispatchEvent(new MouseEvent("mouseup", params));
    coat.dispatchEvent(new MouseEvent("click", params));
  }

  await sleep(checkMs);
  if (getSlideSignature(doc) !== initialSignature) return true;

  const keyParams: KeyboardEventInit = {
    key: "ArrowRight",
    code: "ArrowRight",
    keyCode: 39,
    which: 39,
    bubbles: true,
    cancelable: true,
  };
  doc.dispatchEvent(new KeyboardEvent("keydown", keyParams));
  doc.body?.dispatchEvent(new KeyboardEvent("keydown", keyParams));

  await sleep(checkMs);
  if (getSlideSignature(doc) !== initialSignature) return true;

  const target = coat ?? doc.body;
  target?.dispatchEvent(
    new WheelEvent("wheel", {
      deltaY: 150,
      bubbles: true,
      cancelable: true,
    }),
  );

  await sleep(checkMs);
  return getSlideSignature(doc) !== initialSignature;
}
