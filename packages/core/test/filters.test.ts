import { describe, expect, it } from "vitest";
import { buildFilterString, DEFAULT_FILTERS, mergeFilters, sharpenKernelMatrix } from "../src/filters";

const FILTER_ID = "kiri-sharpen-test";

describe("mergeFilters", () => {
  it("keeps unspecified fields from the current filters", () => {
    const merged = mergeFilters(DEFAULT_FILTERS, { brightness: 1.5 });
    expect(merged).toEqual({ ...DEFAULT_FILTERS, brightness: 1.5 });
  });

  it("clamps negative numeric values to 0", () => {
    const merged = mergeFilters(DEFAULT_FILTERS, {
      brightness: -2,
      contrast: -1,
      saturation: -0.5,
      sharpness: -3,
    });
    expect(merged).toEqual({
      ...DEFAULT_FILTERS,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
    });
  });

  it("toggles boolean fields", () => {
    const merged = mergeFilters(DEFAULT_FILTERS, { grayscale: true, sepia: true });
    expect(merged.grayscale).toBe(true);
    expect(merged.sepia).toBe(true);
  });
});

describe("buildFilterString", () => {
  it("always includes brightness/contrast/saturate", () => {
    expect(buildFilterString(DEFAULT_FILTERS, FILTER_ID)).toBe(
      "brightness(1) contrast(1) saturate(1)"
    );
  });

  it("appends grayscale/sepia only when enabled", () => {
    expect(buildFilterString({ ...DEFAULT_FILTERS, grayscale: true }, FILTER_ID)).toBe(
      "brightness(1) contrast(1) saturate(1) grayscale(1)"
    );
    expect(buildFilterString({ ...DEFAULT_FILTERS, sepia: true }, FILTER_ID)).toBe(
      "brightness(1) contrast(1) saturate(1) sepia(1)"
    );
    expect(
      buildFilterString({ ...DEFAULT_FILTERS, grayscale: true, sepia: true }, FILTER_ID)
    ).toBe("brightness(1) contrast(1) saturate(1) grayscale(1) sepia(1)");
  });

  it("reflects adjusted numeric values", () => {
    expect(
      buildFilterString({ ...DEFAULT_FILTERS, brightness: 1.5, contrast: 0.8 }, FILTER_ID)
    ).toBe("brightness(1.5) contrast(0.8) saturate(1)");
  });

  it("omits the sharpen url() reference when sharpness is 1 or below", () => {
    expect(buildFilterString({ ...DEFAULT_FILTERS, sharpness: 1 }, FILTER_ID)).toBe(
      "brightness(1) contrast(1) saturate(1)"
    );
    expect(buildFilterString({ ...DEFAULT_FILTERS, sharpness: 0 }, FILTER_ID)).toBe(
      "brightness(1) contrast(1) saturate(1)"
    );
  });

  it("prepends the sharpen url() reference when sharpness is above 1, before color/grayscale/sepia", () => {
    // Order matters here beyond style: a url(#id) SVG filter reference
    // placed *after* native CSS filter functions in the same chain produces
    // a fully blank result in Chromium — verified directly in a real
    // browser. It must come first.
    expect(buildFilterString({ ...DEFAULT_FILTERS, sharpness: 2 }, FILTER_ID)).toBe(
      `url(#${FILTER_ID}) brightness(1) contrast(1) saturate(1)`
    );
    expect(
      buildFilterString({ ...DEFAULT_FILTERS, sharpness: 2, grayscale: true }, FILTER_ID)
    ).toBe(`url(#${FILTER_ID}) brightness(1) contrast(1) saturate(1) grayscale(1)`);
  });
});

describe("sharpenKernelMatrix", () => {
  it("is the identity kernel (no sharpening) at sharpness <= 1", () => {
    expect(sharpenKernelMatrix(1)).toBe("0 0 0 0 1 0 0 0 0");
    expect(sharpenKernelMatrix(0)).toBe("0 0 0 0 1 0 0 0 0");
  });

  it("always sums to 1 (needs no separate divisor), for any sharpness above 1", () => {
    for (const sharpness of [1.5, 2, 3, 5.5, 10]) {
      const values = sharpenKernelMatrix(sharpness)
        .split(" ")
        .map(Number);
      const sum = values.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it("increases sharpening strength (larger center weight) as sharpness increases", () => {
    const center = (sharpness: number) => Number(sharpenKernelMatrix(sharpness).split(" ")[4]);
    expect(center(3)).toBeGreaterThan(center(2));
    expect(center(2)).toBeGreaterThan(center(1));
  });
});
