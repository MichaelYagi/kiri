import { describe, expect, it, vi } from "vitest";
import { computeFrameSourceRect, exportCrop } from "../src/export";
import type { KiriState } from "../src/types";

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
    await exportCrop(img, state, { width: 10, height: 10 }, "rectangle", {
      type: "svg" as never,
    }).catch(() => {});

    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/invalid export type "svg"/));
    warnSpy.mockRestore();
  });

  it("warns and falls back on an invalid export format", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const img = document.createElement("img");

    await exportCrop(img, state, { width: 10, height: 10 }, "rectangle", {
      format: "image/gif" as never,
    }).catch(() => {});

    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/invalid export format "image\/gif"/));
    warnSpy.mockRestore();
  });

  it("warns when exporting a circle frame as JPEG (no alpha channel -> black corners)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const img = document.createElement("img");

    await exportCrop(img, state, { width: 10, height: 10 }, "circle", {
      format: "image/jpeg",
    }).catch(() => {});

    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/circle-shaped frame as image\/jpeg/));
    warnSpy.mockRestore();
  });

  it("does not warn for a circle frame exported as PNG", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const img = document.createElement("img");

    await exportCrop(img, state, { width: 10, height: 10 }, "circle", {
      format: "image/png",
    }).catch(() => {});

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
