import type { Filters } from "./types";

export const DEFAULT_FILTERS: Filters = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  grayscale: false,
  sepia: false,
};

/** Merges a partial filter update into the current filters, clamping numeric values to >= 0. */
export function mergeFilters(current: Filters, partial: Partial<Filters>): Filters {
  return {
    brightness: Math.max(0, partial.brightness ?? current.brightness),
    contrast: Math.max(0, partial.contrast ?? current.contrast),
    saturation: Math.max(0, partial.saturation ?? current.saturation),
    grayscale: partial.grayscale ?? current.grayscale,
    sepia: partial.sepia ?? current.sepia,
  };
}

/**
 * Builds a CSS `filter` value from the current filter state. Used verbatim as
 * both the live-preview `img.style.filter` and a canvas 2D context's
 * `ctx.filter` before drawing, so preview and export always match exactly —
 * no separately hand-rolled brightness/contrast/saturation pixel math.
 */
export function buildFilterString(filters: Filters): string {
  const parts = [
    `brightness(${filters.brightness})`,
    `contrast(${filters.contrast})`,
    `saturate(${filters.saturation})`,
  ];
  if (filters.grayscale) parts.push("grayscale(1)");
  if (filters.sepia) parts.push("sepia(1)");
  return parts.join(" ");
}
