import { describe, expect, it } from "vitest";
import {
  clampOffset,
  clampZoom,
  computeCoverScale,
  effectiveNaturalSize,
  effectiveRenderedSize,
  normalizeRotation,
} from "../src/gestures";

describe("effectiveNaturalSize", () => {
  it("keeps dimensions for 0/180 degree rotation", () => {
    expect(effectiveNaturalSize({ width: 400, height: 200 }, 0)).toEqual({
      width: 400,
      height: 200,
    });
    expect(effectiveNaturalSize({ width: 400, height: 200 }, 180)).toEqual({
      width: 400,
      height: 200,
    });
  });

  it("swaps dimensions for 90/270 degree rotation", () => {
    expect(effectiveNaturalSize({ width: 400, height: 200 }, 90)).toEqual({
      width: 200,
      height: 400,
    });
    expect(effectiveNaturalSize({ width: 400, height: 200 }, 270)).toEqual({
      width: 200,
      height: 400,
    });
  });
});

describe("computeCoverScale", () => {
  it("picks the larger of the two axis ratios so the frame is fully covered", () => {
    // image 400x200, frame 100x100 -> width ratio 0.25, height ratio 0.5 -> 0.5
    const scale = computeCoverScale({ width: 400, height: 200 }, { width: 100, height: 100 }, 0);
    expect(scale).toBeCloseTo(0.5);
  });

  it("accounts for a 90 degree rotation swap", () => {
    // rotated: eff natural 200x400, frame 100x100 -> ratios 0.5, 0.25 -> 0.5
    const scale = computeCoverScale({ width: 400, height: 200 }, { width: 100, height: 100 }, 90);
    expect(scale).toBeCloseTo(0.5);
  });
});

describe("clampZoom", () => {
  it("clamps into [min, max]", () => {
    expect(clampZoom(0.5, 1, 4)).toBe(1);
    expect(clampZoom(10, 1, 4)).toBe(4);
    expect(clampZoom(2, 1, 4)).toBe(2);
  });
});

describe("clampOffset", () => {
  it("allows zero offset when the image exactly matches the frame", () => {
    const offset = clampOffset({ x: 0, y: 0 }, { width: 100, height: 100 }, { width: 100, height: 100 });
    expect(offset).toEqual({ x: 0, y: 0 });
  });

  it("clamps offset so the frame never exceeds the rendered image bounds", () => {
    // rendered 200x200, frame 100x100 -> max offset is (200-100)/2 = 50 per axis
    const offset = clampOffset(
      { x: 1000, y: -1000 },
      { width: 200, height: 200 },
      { width: 100, height: 100 }
    );
    expect(offset).toEqual({ x: 50, y: -50 });
  });

  it("collapses to zero when the rendered image is smaller than the frame", () => {
    const offset = clampOffset(
      { x: 30, y: -30 },
      { width: 50, height: 50 },
      { width: 100, height: 100 }
    );
    expect(offset).toEqual({ x: 0, y: 0 });
  });
});

describe("normalizeRotation", () => {
  it("wraps into [0, 360)", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(360)).toBe(0);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
  });
});

describe("effectiveRenderedSize", () => {
  it("combines cover scale and user zoom", () => {
    const size = effectiveRenderedSize(
      { width: 400, height: 200 },
      { width: 100, height: 100 },
      0,
      2
    );
    // cover scale 0.5 * zoom 2 = 1 -> rendered 400x200
    expect(size).toEqual({ width: 400, height: 200 });
  });
});
