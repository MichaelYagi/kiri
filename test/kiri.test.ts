import { beforeEach, describe, expect, it } from "vitest";
import { Kiri } from "../src/kiri";

describe("Kiri", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("builds the stage/frame DOM inside the container", () => {
    new Kiri(container, { frame: { shape: "circle", width: 150, height: 120 } });

    const frame = container.querySelector(".kiri-frame") as HTMLElement;
    expect(container.querySelector(".kiri-stage")).not.toBeNull();
    expect(frame.classList.contains("kiri-frame--circle")).toBe(true);
    expect(frame.style.width).toBe("150px");
    expect(frame.style.height).toBe("120px");
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
