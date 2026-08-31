import { beforeEach, describe, expect, it } from "vitest";
import { Kiri } from "../src/kiri";

describe("Kiri", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("throws a clear error instead of a cryptic TypeError when the container is null", () => {
    expect(() => new Kiri(null as unknown as HTMLElement)).toThrow(/container element is null/);
  });

  it("builds the stage/frame DOM inside the container", () => {
    new Kiri(container, { frame: { shape: "circle", width: 150, height: 120 } });

    const frame = container.querySelector(".kiri-frame") as HTMLElement;
    expect(container.querySelector(".kiri-stage")).not.toBeNull();
    expect(frame.classList.contains("kiri-frame--circle")).toBe(true);
    expect(frame.style.width).toBe("150px");
    expect(frame.style.height).toBe("120px");
  });

  it("auto-sizes the stage to the frame dimensions plus padding by default", () => {
    new Kiri(container, { frame: { width: 150, height: 120 } });

    const stage = container.querySelector(".kiri-stage") as HTMLElement;
    expect(stage.style.width).toBe("190px"); // 150 + 20*2
    expect(stage.style.height).toBe("160px"); // 120 + 20*2
  });

  it("keeps the stage auto-sized after setFrameSize()", () => {
    const cropper = new Kiri(container, { frame: { width: 150, height: 120 } });
    cropper.setFrameSize(200, 100);

    const stage = container.querySelector(".kiri-stage") as HTMLElement;
    expect(stage.style.width).toBe("240px");
    expect(stage.style.height).toBe("140px");
  });

  it("leaves the stage unstyled (fills container via CSS) when autoSizeStage is false", () => {
    new Kiri(container, { frame: { width: 150, height: 120 }, autoSizeStage: false });

    const stage = container.querySelector(".kiri-stage") as HTMLElement;
    expect(stage.style.width).toBe("");
    expect(stage.style.height).toBe("");
  });

  it("clamps zoom to the configured min/max", () => {
    const cropper = new Kiri(container, { minZoom: 1, maxZoom: 3 });
    cropper.setZoom(10);
    expect(cropper.getState().zoom).toBe(3);
    cropper.setZoom(-5);
    expect(cropper.getState().zoom).toBe(1);
  });

  it("snaps rotate() to 90 degree increments and wraps at 360", () => {
    const cropper = new Kiri(container);
    cropper.rotate(90);
    expect(cropper.getState().rotation).toBe(90);
    cropper.rotate(90);
    expect(cropper.getState().rotation).toBe(180);
    cropper.rotate(200); // snaps to nearest 90 -> 180
    expect(cropper.getState().rotation).toBe(0);
  });

  it("ignores rotate() when rotatable is false", () => {
    const cropper = new Kiri(container, { rotatable: false });
    cropper.rotate(90);
    expect(cropper.getState().rotation).toBe(0);
  });

  it("toggles horizontal and vertical flip independently", () => {
    const cropper = new Kiri(container);
    expect(cropper.getState().flip).toEqual({ horizontal: false, vertical: false });

    cropper.flipHorizontal();
    expect(cropper.getState().flip).toEqual({ horizontal: true, vertical: false });

    cropper.flipVertical();
    expect(cropper.getState().flip).toEqual({ horizontal: true, vertical: true });

    cropper.flipHorizontal();
    expect(cropper.getState().flip).toEqual({ horizontal: false, vertical: true });
  });

  it("ignores flip methods when flippable is false", () => {
    const cropper = new Kiri(container, { flippable: false });
    cropper.flipHorizontal();
    cropper.flipVertical();
    expect(cropper.getState().flip).toEqual({ horizontal: false, vertical: false });
  });

  it("merges partial filter updates and applies them to the image element's CSS filter", () => {
    const cropper = new Kiri(container);
    cropper.setFilters({ brightness: 1.4, grayscale: true });

    expect(cropper.getState().filters).toEqual({
      brightness: 1.4,
      contrast: 1,
      saturation: 1,
      grayscale: true,
      sepia: false,
    });

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.style.filter).toBe("brightness(1.4) contrast(1) saturate(1) grayscale(1)");
  });

  it("accepts initial filters via options", () => {
    const cropper = new Kiri(container, { filters: { sepia: true } });
    expect(cropper.getState().filters.sepia).toBe(true);
  });

  it("emits a change event on state updates", () => {
    const cropper = new Kiri(container, { minZoom: 1, maxZoom: 4 });
    const states: number[] = [];
    cropper.on("change", (state) => states.push(state.zoom));

    cropper.setZoom(2);

    expect(states).toEqual([2]);
  });

  it("updates the frame element size via setFrameSize", () => {
    const cropper = new Kiri(container);
    cropper.setFrameSize(80, 60);

    const frame = container.querySelector(".kiri-frame") as HTMLElement;
    expect(frame.style.width).toBe("80px");
    expect(frame.style.height).toBe("60px");
  });

  it("clears the container on destroy", () => {
    const cropper = new Kiri(container);
    cropper.destroy();
    expect(container.innerHTML).toBe("");
  });
});
