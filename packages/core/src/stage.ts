import type { Filters, FrameShape, KiriState, ZoomerPosition } from "./types";
import { buildFilterString, sharpenKernelMatrix } from "./filters";

export interface StageElements {
  stageEl: HTMLDivElement;
  frameEl: HTMLDivElement;
  imageLayerEl: HTMLDivElement;
  imgEl: HTMLImageElement;
  zoomerEl: HTMLInputElement | null;
  /** id of the SVG `feConvolveMatrix` filter `buildFilterString()` references for `sharpness`. */
  sharpenFilterId: string;
  sharpenKernelEl: SVGFEConvolveMatrixElement;
}

const SVG_NS = "http://www.w3.org/2000/svg";
let sharpenFilterCounter = 0;

/**
 * CSS has no `sharpen()` filter, so `sharpness` works through an SVG
 * `feConvolveMatrix` referenced by `url(#id)` from the same filter string as
 * brightness/contrast/saturation (see `filters.ts`'s `buildFilterString()`)
 * — both `img.style.filter` and a canvas 2D context's `ctx.filter` support
 * `url(#id)` references identically, so this one definition drives both live
 * preview and export. A unique id per instance (rather than one shared id)
 * avoids collisions between multiple `Kiri` instances on the same page.
 * `color-interpolation-filters: sRGB` matters — SVG filter primitives
 * default to linearRGB, which would visibly shift brightness/contrast
 * relative to the sRGB-space CSS filters earlier in the same filter string.
 */
function createSharpenFilter(): { svg: SVGSVGElement; filterId: string; kernelEl: SVGFEConvolveMatrixElement } {
  sharpenFilterCounter += 1;
  const filterId = `kiri-sharpen-${sharpenFilterCounter}`;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";

  const filterEl = document.createElementNS(SVG_NS, "filter");
  filterEl.setAttribute("id", filterId);
  filterEl.setAttribute("color-interpolation-filters", "sRGB");

  const kernelEl = document.createElementNS(SVG_NS, "feConvolveMatrix");
  kernelEl.setAttribute("order", "3");
  kernelEl.setAttribute("divisor", "1");
  kernelEl.setAttribute("edgeMode", "duplicate");
  // Without this, feConvolveMatrix convolves the alpha channel too — the
  // kernel's negative neighbor weights can drive alpha toward 0 right at a
  // sharp edge, turning an opaque photo semi-transparent exactly where
  // sharpening is strongest. Sharpening should only ever touch color.
  kernelEl.setAttribute("preserveAlpha", "true");
  kernelEl.setAttribute("kernelMatrix", sharpenKernelMatrix(1));

  filterEl.appendChild(kernelEl);
  svg.appendChild(filterEl);

  return { svg, filterId, kernelEl };
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
  cornerRadius: number,
  zoomer: ZoomerConfig
): StageElements {
  container.innerHTML = "";

  const stageEl = document.createElement("div");
  stageEl.className = "kiri-stage";
  // Keyboard support (see gestures.ts's onKeyDown) only fires once the
  // element can receive focus; role/label make it announce sensibly to
  // screen readers instead of as an unlabeled generic div.
  stageEl.tabIndex = 0;
  stageEl.setAttribute("role", "application");
  stageEl.setAttribute(
    "aria-label",
    "Image cropper. Drag to pan. Arrow keys to pan, plus/minus to zoom, 0 to reset."
  );

  const imageLayerEl = document.createElement("div");
  imageLayerEl.className = "kiri-image-layer";

  const imgEl = document.createElement("img");
  imgEl.draggable = false;
  imageLayerEl.appendChild(imgEl);

  const frameEl = document.createElement("div");
  frameEl.className =
    frameShape === "circle"
      ? "kiri-frame kiri-frame--circle"
      : frameShape === "rounded-rectangle"
        ? "kiri-frame kiri-frame--rounded-rectangle"
        : "kiri-frame";
  setFrameSize(frameEl, frameWidth, frameHeight);
  // Radius is a per-instance pixel value (unlike circle's fixed 50%), so it
  // can't be a static CSS rule — set inline instead.
  if (frameShape === "rounded-rectangle") {
    frameEl.style.borderRadius = `${cornerRadius}px`;
  }

  const { svg: sharpenSvg, filterId: sharpenFilterId, kernelEl: sharpenKernelEl } =
    createSharpenFilter();

  stageEl.appendChild(imageLayerEl);
  stageEl.appendChild(frameEl);
  stageEl.appendChild(sharpenSvg);

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

  return { stageEl, frameEl, imageLayerEl, imgEl, zoomerEl, sharpenFilterId, sharpenKernelEl };
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

export function applyFilters(
  imgEl: HTMLImageElement,
  filters: Filters,
  sharpenKernelEl: SVGFEConvolveMatrixElement,
  sharpenFilterId: string
): void {
  sharpenKernelEl.setAttribute("kernelMatrix", sharpenKernelMatrix(filters.sharpness));
  imgEl.style.filter = buildFilterString(filters, sharpenFilterId);
}
