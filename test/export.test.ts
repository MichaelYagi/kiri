import { describe, expect, it } from "vitest";
import { computeFrameSourceRect } from "../src/export";

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
