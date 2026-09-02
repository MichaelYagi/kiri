import { describe, expect, it, vi } from "vitest";
import { computeCropRegion, computeFrameSourceRect, exportCrop } from "../src/export";
import type { KiriState } from "../src/types";

const noFlip = { horizontal: false, vertical: false };
const baseFilters = { brightness: 1, contrast: 1, saturation: 1, grayscale: false, sepia: false };

function state(overrides: Partial<KiriState>): KiriState {
  return { zoom: 1, offset: { x: 0, y: 0 }, rotation: 0, flip: noFlip, filters: baseFilters, ...overrides };
}

describe("computeCropRegion", () => {
  it("returns the full image when the frame exactly covers the cover-scaled image", () => {
    const region = computeCropRegion(
      { width: 400, height: 300 },
      { width: 200, height: 150 },
      state({})
    );
    expect(region).toEqual({ x: 0, y: 0, width: 400, height: 300, rotation: 0, flip: noFlip });
  });

  it("shrinks the region when a pan offset drags the frame past an image edge", () => {
    // Frame (200x150) covers exactly the scaled image (200x150 at scale
    // 0.5); shifting the image right by 50 rendered px pushes the frame's
    // left edge 100 natural px past the image's own left edge (0), so the
    // crop region must clip, not just shift.
    const region = computeCropRegion(
      { width: 400, height: 300 },
      { width: 200, height: 150 },
      state({ offset: { x: 50, y: 0 } })
    );
    expect(region).toEqual({ x: 0, y: 0, width: 300, height: 300, rotation: 0, flip: noFlip });
  });

  it("maps a 90-degree rotation back into the original image's own axes", () => {
    const region = computeCropRegion(
      { width: 400, height: 300 },
      { width: 150, height: 150 },
      state({ rotation: 90 })
    );
    expect(region).toEqual({ x: 50, y: 0, width: 300, height: 300, rotation: 90, flip: noFlip });
  });

  it("carries flip through untouched, since mirroring is content-only", () => {
    const region = computeCropRegion(
      { width: 400, height: 300 },
      { width: 200, height: 150 },
      state({ flip: { horizontal: true, vertical: false } })
    );
    expect(region.flip).toEqual({ horizontal: true, vertical: false });
  });
});

describe("computeFrameSourceRect", () => {
  it("centers the frame on the rendered image when offset is zero", () => {
    const rect = computeFrameSourceRect(
      { width: 200, height: 200 },
      { x: 0, y: 0 },
      { width: 100, height: 100 }
    );
    expect(rect).toEqual({ left: 50, top: 50 });
  });

  it("shifts the source rect opposite to a positive offset", () => {
    // dragging the image right by 20 (offset.x = 20) means the frame now
    // sits further left within the image's local space.
    const rect = computeFrameSourceRect(
      { width: 200, height: 200 },
      { x: 20, y: -10 },
      { width: 100, height: 100 }
    );
    expect(rect).toEqual({ left: 30, top: 60 });
  });
});

describe("exportCrop option validation", () => {
  const state: KiriState = {
    zoom: 1,
    offset: { x: 0, y: 0 },
    rotation: 0,
    flip: { horizontal: false, vertical: false },
    filters: { brightness: 1, contrast: 1, saturation: 1, grayscale: false, sepia: false },
  };

  it("warns and falls back on an invalid export type", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const img = document.createElement("img");

    // jsdom has no real 2D canvas context, so this rejects downstream —
    // the validation warning fires before that point, which is what's
    // under test here.
    await exportCrop(img, state, { width: 10, height: 10 }, "rectangle", 0, {
      type: "svg" as never,
    }).catch(() => {});

    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/invalid export type "svg"/));
    warnSpy.mockRestore();
  });

  it("warns and falls back on an invalid export format", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const img = document.createElement("img");

    await exportCrop(img, state, { width: 10, height: 10 }, "rectangle", 0, {
      format: "image/gif" as never,
    }).catch(() => {});

    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/invalid export format "image\/gif"/));
    warnSpy.mockRestore();
  });

  it("warns when exporting a circle frame as JPEG (no alpha channel -> black corners)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const img = document.createElement("img");

    await exportCrop(img, state, { width: 10, height: 10 }, "circle", 0, {
      format: "image/jpeg",
    }).catch(() => {});

    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/circle-shaped frame as image\/jpeg/));
    warnSpy.mockRestore();
  });

  it("does not warn for a circle frame exported as PNG", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const img = document.createElement("img");

    await exportCrop(img, state, { width: 10, height: 10 }, "circle", 0, {
      format: "image/png",
    }).catch(() => {});

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("warns when exporting a rounded-rectangle frame as JPEG (no alpha channel -> black corners)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const img = document.createElement("img");

    await exportCrop(img, state, { width: 10, height: 10 }, "rounded-rectangle", 20, {
      format: "image/jpeg",
    }).catch(() => {});

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/rounded-rectangle-shaped frame as image\/jpeg/)
    );
    warnSpy.mockRestore();
  });
});
