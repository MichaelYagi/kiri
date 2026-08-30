import type { Filters, FrameShape, KiriState } from "./types";
import { buildFilterString } from "./filters";

export interface StageElements {
  stageEl: HTMLDivElement;
  frameEl: HTMLDivElement;
  imageLayerEl: HTMLDivElement;
  imgEl: HTMLImageElement;
}

export function createStage(
  container: HTMLElement,
  frameShape: FrameShape,
  frameWidth: number,
  frameHeight: number
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
  container.appendChild(stageEl);

  return { stageEl, frameEl, imageLayerEl, imgEl };
}

export function setFrameSize(
  frameEl: HTMLDivElement,
  width: number,
  height: number
): void {
  frameEl.style.width = `${width}px`;
  frameEl.style.height = `${height}px`;
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
