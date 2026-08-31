import type {
  ExportFormat,
  ExportOptions,
  ExportResult,
  ExportType,
  FrameShape,
  KiriState,
  Offset,
} from "./types";
import { computeCoverScale, effectiveRenderedSize, type Size } from "./gestures";
import { buildFilterString } from "./filters";
import { resolveEnumOption } from "./validate";

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

export function renderCropToCanvas(
  img: HTMLImageElement,
  state: KiriState,
  frame: Size,
  outputWidth: number,
  outputHeight: number,
  frameShape: FrameShape
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
  // so the browser's own filter implementation guarantees they match exactly.
  sctx.filter = buildFilterString(state.filters);
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

  // The circle frame is otherwise just a visual overlay (stage.ts's
  // .kiri-frame--circle border) — without this, the export would always be
  // a plain rectangle regardless of frame.shape. Clipping to an ellipse
  // inscribed in the output canvas matches what's visible on screen even
  // when a custom output width/height changes its aspect ratio.
  if (frameShape === "circle") {
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

  if (frameShape === "circle") octx.restore();

  return outCanvas;
}

export async function exportCrop(
  img: HTMLImageElement,
  state: KiriState,
  frame: Size,
  frameShape: FrameShape,
  options: ExportOptions
): Promise<ExportResult> {
  const type = resolveEnumOption(options.type, VALID_EXPORT_TYPES, "base64", "export type");
  const format = resolveEnumOption(options.format, VALID_EXPORT_FORMATS, "image/png", "export format");
  const quality = options.quality;
  const width = options.width ?? frame.width;
  const height = options.height ?? frame.height;

  if (frameShape === "circle" && format === "image/jpeg") {
    console.warn(
      "Kiri: exporting a circle-shaped frame as image/jpeg — JPEG has no " +
        "alpha channel, so the area outside the circle will render as solid " +
        "black instead of transparent. Use image/png or image/webp instead."
    );
  }

  const canvas = renderCropToCanvas(img, state, frame, width, height, frameShape);

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
