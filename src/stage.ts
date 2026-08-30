import type { FrameShape, KiriState } from "./types";

const STYLE_ID = "kiri-styles";

const STYLES = `
.kiri-stage {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 200px;
  background: #333;
  touch-action: none;
  cursor: grab;
  user-select: none;
}
.kiri-stage.kiri-dragging {
  cursor: grabbing;
}
.kiri-image-layer {
  position: absolute;
  top: 50%;
  left: 50%;
  pointer-events: none;
}
.kiri-image-layer img {
  display: block;
  max-width: none;
}
.kiri-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
.kiri-frame--circle {
  border-radius: 50%;
}
.kiri-frame-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fff;
  border: 1px solid #333;
  border-radius: 50%;
  pointer-events: auto;
  cursor: nwse-resize;
}
`;

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

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
  ensureStyles();

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
