import { describe, expect, it } from "vitest";
import { buildFilterString, DEFAULT_FILTERS, mergeFilters } from "../src/filters";

describe("mergeFilters", () => {
  it("keeps unspecified fields from the current filters", () => {
    const merged = mergeFilters(DEFAULT_FILTERS, { brightness: 1.5 });
    expect(merged).toEqual({ ...DEFAULT_FILTERS, brightness: 1.5 });
  });

  it("clamps negative numeric values to 0", () => {
    const merged = mergeFilters(DEFAULT_FILTERS, { brightness: -2, contrast: -1, saturation: -0.5 });
    expect(merged).toEqual({ ...DEFAULT_FILTERS, brightness: 0, contrast: 0, saturation: 0 });
  });

  it("toggles boolean fields", () => {
    const merged = mergeFilters(DEFAULT_FILTERS, { grayscale: true, sepia: true });
    expect(merged.grayscale).toBe(true);
    expect(merged.sepia).toBe(true);
  });
});

describe("buildFilterString", () => {
  it("always includes brightness/contrast/saturate", () => {
    expect(buildFilterString(DEFAULT_FILTERS)).toBe(
      "brightness(1) contrast(1) saturate(1)"
    );
  });

  it("appends grayscale/sepia only when enabled", () => {
    expect(buildFilterString({ ...DEFAULT_FILTERS, grayscale: true })).toBe(
      "brightness(1) contrast(1) saturate(1) grayscale(1)"
    );
    expect(buildFilterString({ ...DEFAULT_FILTERS, sepia: true })).toBe(
      "brightness(1) contrast(1) saturate(1) sepia(1)"
    );
    expect(buildFilterString({ ...DEFAULT_FILTERS, grayscale: true, sepia: true })).toBe(
      "brightness(1) contrast(1) saturate(1) grayscale(1) sepia(1)"
    );
  });

  it("reflects adjusted numeric values", () => {
    expect(buildFilterString({ ...DEFAULT_FILTERS, brightness: 1.5, contrast: 0.8 })).toBe(
      "brightness(1.5) contrast(0.8) saturate(1)"
    );
  });
});
