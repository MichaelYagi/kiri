import type { ExportOptions, ExportResult, KiriState, Offset } from "./types";
import { computeCoverScale, effectiveRenderedSize, type Size } from "./gestures";

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
  outputHeight: number
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
  sctx.scale(scale, scale);
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
  return outCanvas;
}

export async function exportCrop(
  img: HTMLImageElement,
  state: KiriState,
  frame: Size,
  options: ExportOptions
): Promise<ExportResult> {
  const type = options.type ?? "base64";
  const format = options.format ?? "image/png";
  const quality = options.quality;
  const width = options.width ?? frame.width;
  const height = options.height ?? frame.height;

  const canvas = renderCropToCanvas(img, state, frame, width, height);

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
