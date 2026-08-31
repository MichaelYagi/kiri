import type { Filters, FrameShape, KiriState, ZoomerPosition } from "./types";
import { buildFilterString } from "./filters";

export interface StageElements {
  stageEl: HTMLDivElement;
  frameEl: HTMLDivElement;
  imageLayerEl: HTMLDivElement;
  imgEl: HTMLImageElement;
  zoomerEl: HTMLInputElement | null;
}

export interface ZoomerConfig {
  show: boolean;
  position: ZoomerPosition;
  min: number;
  max: number;
  value: number;
}

export function createStage(
  container: HTMLElement,
  frameShape: FrameShape,
  frameWidth: number,
  frameHeight: number,
  zoomer: ZoomerConfig
): StageElements {
  container.innerHTML = "";

  const stageEl = document.createElement("div");
  stageEl.className = "kiri-stage";

  const imageLayerEl = document.createElement("div");
  imageLayerEl.className = "kiri-image-layer";

  const imgEl = document.createElement("img");
  imgEl.draggable = false;
  imageLayerEl.appendChild(imgEl);

  const frameEl = document.createElement("div");
  frameEl.className =
    frameShape === "circle" ? "kiri-frame kiri-frame--circle" : "kiri-frame";
  setFrameSize(frameEl, frameWidth, frameHeight);

  stageEl.appendChild(imageLayerEl);
  stageEl.appendChild(frameEl);

  let zoomerEl: HTMLInputElement | null = null;

  if (zoomer.show) {
    const rootEl = document.createElement("div");
    rootEl.className = `kiri-root kiri-root--${zoomer.position}`;

    zoomerEl = document.createElement("input");
    zoomerEl.type = "range";
    zoomerEl.className = "kiri-zoomer";
    zoomerEl.min = String(zoomer.min);
    zoomerEl.max = String(zoomer.max);
    zoomerEl.step = "0.01";
    zoomerEl.value = String(zoomer.value);

    rootEl.appendChild(stageEl);
    rootEl.appendChild(zoomerEl);
    container.appendChild(rootEl);
  } else {
    container.appendChild(stageEl);
  }

  return { stageEl, frameEl, imageLayerEl, imgEl, zoomerEl };
}

export function setFrameSize(
  frameEl: HTMLDivElement,
  width: number,
  height: number
): void {
  frameEl.style.width = `${width}px`;
  frameEl.style.height = `${height}px`;
}

/** Padding added around the frame when the stage auto-sizes itself — small
 * enough to avoid empty space, big enough to fit the resize handle and give
 * a visible drag margin. */
export const STAGE_AUTO_SIZE_PADDING = 20;

export function setStageSize(
  stageEl: HTMLDivElement,
  width: number,
  height: number
): void {
  stageEl.style.width = `${width}px`;
  stageEl.style.height = `${height}px`;
}

export function applyTransform(
  imageLayerEl: HTMLDivElement,
  state: KiriState,
  renderedScale: number
): void {
  // translate(-50%,-50%) centers the layer's own center at the stage center;
  // the pixel translate shifts it by the (rotation/scale-independent) offset;
  // rotate then scale (with flip folded into scale's sign) apply around the
  // layer's own center (default transform-origin), flip first/innermost so a
  // mirrored image still rotates the way the user expects.
  const scaleX = renderedScale * (state.flip.horizontal ? -1 : 1);
  const scaleY = renderedScale * (state.flip.vertical ? -1 : 1);
  imageLayerEl.style.transform =
    `translate(-50%, -50%) ` +
    `translate(${state.offset.x}px, ${state.offset.y}px) ` +
    `rotate(${state.rotation}deg) ` +
    `scale(${scaleX}, ${scaleY})`;
}

export function applyFilters(imgEl: HTMLImageElement, filters: Filters): void {
  imgEl.style.filter = buildFilterString(filters);
}
