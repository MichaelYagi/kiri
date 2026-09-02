import type { Filters } from "./types";

export const DEFAULT_FILTERS: Filters = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  sharpness: 1,
  grayscale: false,
  sepia: false,
};

/** Merges a partial filter update into the current filters, clamping numeric values to >= 0. */
export function mergeFilters(current: Filters, partial: Partial<Filters>): Filters {
  return {
    brightness: Math.max(0, partial.brightness ?? current.brightness),
    contrast: Math.max(0, partial.contrast ?? current.contrast),
    saturation: Math.max(0, partial.saturation ?? current.saturation),
    sharpness: Math.max(0, partial.sharpness ?? current.sharpness),
    grayscale: partial.grayscale ?? current.grayscale,
    sepia: partial.sepia ?? current.sepia,
  };
}

/**
 * The 3x3 unsharp-mask kernel for `sharpness`, as a `feConvolveMatrix`
 * `kernelMatrix` attribute value (row-major, space-separated):
 *
 * ```
 *  0  -k   0
 * -k 1+4k -k
 *  0  -k   0
 * ```
 *
 * The matrix always sums to `1`, so the convolution needs no separate
 * `divisor`. `sharpness <= 1` collapses to the identity kernel (center `1`,
 * neighbors `0`) — no blur/sharpen either way, matching the `1` = unchanged
 * convention used by the other numeric filters. `4.5` is chosen so a
 * `sharpness` of `2`–`3` (a reasonable slider range) lands in a visually
 * subtle-to-strong sharpening range, not an immediately harsh one.
 */
export function sharpenKernelMatrix(sharpness: number): string {
  const weight = sharpness > 1 ? (sharpness - 1) / 4.5 : 0;
  const center = 1 + 4 * weight;
  const neighbor = -weight;
  return `0 ${neighbor} 0 ${neighbor} ${center} ${neighbor} 0 ${neighbor} 0`;
}

/**
 * Builds a CSS `filter` value from the current filter state. Used verbatim as
 * both the live-preview `img.style.filter` and a canvas 2D context's
 * `ctx.filter` before drawing, so preview and export always match exactly —
 * no separately hand-rolled brightness/contrast/saturation/sharpness pixel
 * math. Brightness/contrast/saturation/grayscale/sepia are native CSS filter
 * functions; CSS has no `sharpen()`, so `sharpness` instead references an
 * SVG `feConvolveMatrix` filter (by `sharpenFilterId`) that `stage.ts` keeps
 * in sync with the current `sharpness` value — `ctx.filter` and
 * `img.style.filter` both support `url(#id)` references to it identically.
 *
 * The `url(#id)` reference goes **first**, before the native CSS filter
 * functions — not last, despite sharpening-as-a-final-step being the more
 * common photo-editing order. Verified directly in a real browser (Chromium)
 * that a `url(#id)` SVG filter reference placed *after* one or more native
 * CSS filter functions in the same chain silently produces a fully blank
 * (transparent) result, while the identical chain with `url(#id)` first
 * renders correctly. Sharpening a source that hasn't had brightness/contrast/
 * saturation applied yet is a legitimate (if less common) ordering rather
 * than a compromise — but the ordering here is load-bearing either way, not
 * arbitrary; don't reorder this without re-verifying in a real browser.
 */
export function buildFilterString(filters: Filters, sharpenFilterId: string): string {
  const parts: string[] = [];
  if (filters.sharpness > 1) parts.push(`url(#${sharpenFilterId})`);
  parts.push(
    `brightness(${filters.brightness})`,
    `contrast(${filters.contrast})`,
    `saturate(${filters.saturation})`
  );
  if (filters.grayscale) parts.push("grayscale(1)");
  if (filters.sepia) parts.push("sepia(1)");
  return parts.join(" ");
}
