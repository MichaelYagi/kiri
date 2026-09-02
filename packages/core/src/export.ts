import type {
  CropRegion,
  ExportFormat,
  ExportOptions,
  ExportResult,
  ExportType,
  FrameShape,
  KiriState,
  Offset,
} from "./types";
import {
  computeCoverScale,
  effectiveRenderedSize,
  normalizeRotation,
  type Size,
} from "./gestures";
import { buildFilterString } from "./filters";
import { resolveEnumOption } from "./validate";

function clampNum(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const VALID_EXPORT_TYPES: ExportType[] = ["base64", "blob", "canvas"];
const VALID_EXPORT_FORMATS: ExportFormat[] = ["image/jpeg", "image/png", "image/webp"];

/**
 * Top-left corner of the frame, in the local pixel space of the rendered
 * (rotated + scaled) image. Pure so the crop-region math is testable without
 * a real canvas: the frame is centered on the stage, the image's own center
 * sits at `offset` from that same point, so the frame's top-left in the
 * rendered image's local space is the rendered center, shifted back by the
 * offset.
 */
export function computeFrameSourceRect(
  rendered: Size,
  offset: Offset,
  frame: Size
): { left: number; top: number } {
  return {
    left: rendered.width / 2 - offset.x - frame.width / 2,
    top: rendered.height / 2 - offset.y - frame.height / 2,
  };
}

/**
 * Maps the current crop selection back into the *original, unrotated,
 * unflipped* source image's own pixel coordinates. Corner-based: takes the
 * frame rect's four corners in rendered (rotated + scaled) space, undoes the
 * scale, then inverse-rotates each corner (rotation is always a multiple of
 * 90°, so this stays an axis-aligned rectangle — no interpolation needed)
 * back into the natural image's coordinate space, then takes the bounding
 * box. Flip doesn't move the rectangle (mirroring is content-only), so it's
 * carried through untouched in the result for the caller to apply.
 */
export function computeCropRegion(natural: Size, frame: Size, state: KiriState): CropRegion {
  const scale = computeCoverScale(natural, frame, state.rotation) * state.zoom;
  const rendered = effectiveRenderedSize(natural, frame, state.rotation, state.zoom);
  const { left: frameLeft, top: frameTop } = computeFrameSourceRect(rendered, state.offset, frame);

  const renderedCenter = { x: rendered.width / 2, y: rendered.height / 2 };
  const naturalCenter = { x: natural.width / 2, y: natural.height / 2 };
  const rotation = normalizeRotation(state.rotation);

  const corners = [
    { x: frameLeft, y: frameTop },
    { x: frameLeft + frame.width, y: frameTop },
    { x: frameLeft, y: frameTop + frame.height },
    { x: frameLeft + frame.width, y: frameTop + frame.height },
  ].map(({ x, y }) => {
    const cx = (x - renderedCenter.x) / scale;
    const cy = (y - renderedCenter.y) / scale;
    let u: number;
    let v: number;
    if (rotation === 90) {
      u = cy;
      v = -cx;
    } else if (rotation === 180) {
      u = -cx;
      v = -cy;
    } else if (rotation === 270) {
      u = -cy;
      v = cx;
    } else {
      u = cx;
      v = cy;
    }
    return { x: u + naturalCenter.x, y: v + naturalCenter.y };
  });

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  // Clamp each edge independently (not just the origin) — a frame that
  // overhangs the image (e.g. offset drags it past an edge) must shrink
  // width/height to match, not just get shifted while keeping its
  // unclamped size.
  const left = clampNum(Math.min(...xs), 0, natural.width);
  const top = clampNum(Math.min(...ys), 0, natural.height);
  const right = clampNum(Math.max(...xs), 0, natural.width);
  const bottom = clampNum(Math.max(...ys), 0, natural.height);

  return {
    x: Math.round(left),
    y: Math.round(top),
    width: Math.round(right - left),
    height: Math.round(bottom - top),
    rotation,
    flip: { ...state.flip },
  };
}

export function renderCropToCanvas(
  img: HTMLImageElement,
  state: KiriState,
  frame: Size,
  outputWidth: number,
  outputHeight: number,
  frameShape: FrameShape,
  cornerRadius: number,
  sharpenFilterId: string
): HTMLCanvasElement {
  const natural: Size = { width: img.naturalWidth, height: img.naturalHeight };
  const scale = computeCoverScale(natural, frame, state.rotation) * state.zoom;
  const rendered = effectiveRenderedSize(natural, frame, state.rotation, state.zoom);

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = Math.max(1, Math.round(rendered.width));
  sourceCanvas.height = Math.max(1, Math.round(rendered.height));
  const sctx = sourceCanvas.getContext("2d");
  if (!sctx) throw new Error("Kiri: unable to get 2D canvas context");

  sctx.translate(sourceCanvas.width / 2, sourceCanvas.height / 2);
  sctx.rotate((state.rotation * Math.PI) / 180);
  // Flip is folded into scale's sign, applied before rotate (matches
  // stage.ts's transform order) so rotation happens in "already mirrored"
  // space, consistent with what the user sees on screen.
  sctx.scale(scale * (state.flip.horizontal ? -1 : 1), scale * (state.flip.vertical ? -1 : 1));
  // Same CSS filter string as the live preview (see stage.ts's applyFilters),
  // so the browser's own filter implementation guarantees they match exactly
  // — including sharpness, whose SVG feConvolveMatrix definition (see
  // stage.ts) `url(#sharpenFilterId)` references works identically here even
  // though sourceCanvas itself is never attached to the document.
  sctx.filter = buildFilterString(state.filters, sharpenFilterId);
  sctx.drawImage(img, -natural.width / 2, -natural.height / 2, natural.width, natural.height);

  const { left: frameLeft, top: frameTop } = computeFrameSourceRect(
    rendered,
    state.offset,
    frame
  );

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outputWidth;
  outCanvas.height = outputHeight;
  const octx = outCanvas.getContext("2d");
  if (!octx) throw new Error("Kiri: unable to get 2D canvas context");

  // A non-rectangle frame is otherwise just a visual overlay (stage.ts's
  // .kiri-frame--circle/--rounded-rectangle) — without this, the export
  // would always be a plain rectangle regardless of frame.shape.
  if (frameShape === "circle") {
    // Ellipse inscribed in the output canvas matches what's visible on
    // screen even when a custom output width/height changes its aspect ratio.
    octx.save();
    octx.beginPath();
    octx.ellipse(
      outputWidth / 2,
      outputHeight / 2,
      outputWidth / 2,
      outputHeight / 2,
      0,
      0,
      Math.PI * 2
    );
    octx.clip();
  } else if (frameShape === "rounded-rectangle") {
    // cornerRadius is a fixed pixel value tied to the on-screen frame size;
    // scale it by how much bigger/smaller the output is than the frame so a
    // custom output width/height still looks proportionally the same.
    const scale = outputWidth / frame.width;
    const radius = clampNum(cornerRadius * scale, 0, Math.min(outputWidth, outputHeight) / 2);
    octx.save();
    octx.beginPath();
    octx.roundRect(0, 0, outputWidth, outputHeight, radius);
    octx.clip();
  }

  octx.drawImage(
    sourceCanvas,
    frameLeft,
    frameTop,
    frame.width,
    frame.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  if (frameShape === "circle" || frameShape === "rounded-rectangle") octx.restore();

  return outCanvas;
}

export async function exportCrop(
  img: HTMLImageElement,
  state: KiriState,
  frame: Size,
  frameShape: FrameShape,
  cornerRadius: number,
  sharpenFilterId: string,
  options: ExportOptions
): Promise<ExportResult> {
  const type = resolveEnumOption(options.type, VALID_EXPORT_TYPES, "base64", "export type");
  const format = resolveEnumOption(options.format, VALID_EXPORT_FORMATS, "image/png", "export format");
  const quality = options.quality;
  const width = options.width ?? frame.width;
  const height = options.height ?? frame.height;

  if ((frameShape === "circle" || frameShape === "rounded-rectangle") && format === "image/jpeg") {
    console.warn(
      `Kiri: exporting a ${frameShape}-shaped frame as image/jpeg — JPEG has ` +
        "no alpha channel, so the area outside the shape will render as " +
        "solid black instead of transparent. Use image/png or image/webp instead."
    );
  }

  const canvas = renderCropToCanvas(
    img,
    state,
    frame,
    width,
    height,
    frameShape,
    cornerRadius,
    sharpenFilterId
  );

  if (type === "canvas") return canvas;
  if (type === "base64") return canvas.toDataURL(format, quality);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Kiri: canvas.toBlob failed"))),
      format,
      quality
    );
  });
}
