import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("applies a rounded-rectangle frame's class and corner radius (default 20px)", () => {
    new Kiri(container, { frame: { shape: "rounded-rectangle", width: 150, height: 120 } });

    const frame = container.querySelector(".kiri-frame") as HTMLElement;
    expect(frame.classList.contains("kiri-frame--rounded-rectangle")).toBe(true);
    expect(frame.style.borderRadius).toBe("20px");
  });

  it("applies a custom cornerRadius for a rounded-rectangle frame", () => {
    new Kiri(container, {
      frame: { shape: "rounded-rectangle", width: 150, height: 120, cornerRadius: 8 },
    });

    const frame = container.querySelector(".kiri-frame") as HTMLElement;
    expect(frame.style.borderRadius).toBe("8px");
  });

  it("doesn't set a border-radius for rectangle/circle frames", () => {
    new Kiri(container, { frame: { shape: "rectangle" } });
    expect((container.querySelector(".kiri-frame") as HTMLElement).style.borderRadius).toBe("");
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
      sharpness: 1,
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

  describe("sharpness", () => {
    it("does not reference the SVG sharpen filter when sharpness is unchanged (<= 1)", () => {
      new Kiri(container);
      const img = container.querySelector("img") as HTMLImageElement;
      expect(img.style.filter).not.toMatch(/url\(/);
    });

    it("references the SVG sharpen filter once sharpness is set above 1", () => {
      const cropper = new Kiri(container);
      cropper.setFilters({ sharpness: 2 });

      const img = container.querySelector("img") as HTMLImageElement;
      const kernelEl = container.querySelector("feConvolveMatrix") as SVGFEConvolveMatrixElement;
      const filterId = (container.querySelector("filter") as SVGFilterElement).id;

      expect(img.style.filter).toContain(`url(#${filterId})`);
      // center weight > 1 once sharpness > 1 -> real sharpening, not the identity kernel.
      expect(Number(kernelEl.getAttribute("kernelMatrix")!.split(" ")[4])).toBeGreaterThan(1);
    });

    it("removes the url() reference again when sharpness drops back to 1", () => {
      const cropper = new Kiri(container);
      cropper.setFilters({ sharpness: 2 });
      cropper.setFilters({ sharpness: 1 });

      const img = container.querySelector("img") as HTMLImageElement;
      expect(img.style.filter).not.toMatch(/url\(/);
    });

    it("gives each Kiri instance its own SVG sharpen filter id (no collisions on one page)", () => {
      const containerB = document.createElement("div");
      document.body.appendChild(containerB);

      new Kiri(container);
      new Kiri(containerB);

      const idA = (container.querySelector("filter") as SVGFilterElement).id;
      const idB = (containerB.querySelector("filter") as SVGFilterElement).id;
      expect(idA).not.toBe(idB);
    });
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

  describe("setOffset / reset / getCropRegion", () => {
    // naturalSize/initialState are private; a real load() needs an actual
    // image decode which jsdom doesn't perform, so tests set them directly —
    // the same state load() would produce once the image resolves.
    function withNaturalSize(cropper: Kiri, width: number, height: number): void {
      (cropper as unknown as { naturalSize: { width: number; height: number } }).naturalSize = {
        width,
        height,
      };
    }

    it("setOffset clamps so the frame stays covered by the rendered image", () => {
      const cropper = new Kiri(container, { frame: { width: 200, height: 150 } });
      withNaturalSize(cropper, 400, 300); // cover-scale 0.5 -> rendered exactly matches frame

      cropper.setOffset({ x: 1000, y: -1000 });
      expect(cropper.getState().offset).toEqual({ x: 0, y: 0 });
    });

    it("setOffset accepts an in-range offset", () => {
      const cropper = new Kiri(container, { frame: { width: 200, height: 150 }, maxZoom: 4 });
      withNaturalSize(cropper, 800, 600); // cover-scale 0.25; zoom 2x -> rendered 400x300, room to pan
      cropper.setZoom(2);

      cropper.setOffset({ x: 50, y: 20 });
      expect(cropper.getState().offset).toEqual({ x: 50, y: 20 });
    });

    it("getCropRegion delegates to computeCropRegion using the current natural size/frame/state", () => {
      const cropper = new Kiri(container, { frame: { width: 200, height: 150 } });
      withNaturalSize(cropper, 400, 300);

      expect(cropper.getCropRegion()).toEqual({
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        rotation: 0,
        flip: { horizontal: false, vertical: false },
      });
    });

    it("reset() reverts zoom/rotation/flip/filters to the post-load() snapshot", async () => {
      const cropper = new Kiri(container, { minZoom: 1, maxZoom: 4 });
      const imgEl = container.querySelector("img") as HTMLImageElement;
      const loadPromise = cropper.load("fake.jpg", { zoom: 2, rotation: 90 });
      imgEl.onload?.(new Event("load"));
      await loadPromise;

      cropper.setZoom(4);
      cropper.rotate(90);
      cropper.flipHorizontal();
      cropper.setFilters({ brightness: 1.8 });

      cropper.reset();

      expect(cropper.getState()).toEqual({
        zoom: 2,
        offset: { x: 0, y: 0 },
        rotation: 90,
        flip: { horizontal: false, vertical: false },
        filters: {
          brightness: 1,
          contrast: 1,
          saturation: 1,
          sharpness: 1,
          grayscale: false,
          sepia: false,
        },
        framePosition: { x: 0, y: 0 },
      });
    });

    it("reset() is a no-op before anything has been loaded", () => {
      const cropper = new Kiri(container);
      cropper.setZoom(3);
      cropper.reset();
      expect(cropper.getState().zoom).toBe(3);
    });
  });

  describe("load() object URL lifecycle", () => {
    it("revokes the object URL even when the image fails to decode (no leak on error)", async () => {
      // jsdom doesn't implement createObjectURL/revokeObjectURL at all, so
      // there's nothing for vi.spyOn to wrap — install plain fakes instead.
      const createFn = vi.fn().mockReturnValue("blob:fake");
      const revokeFn = vi.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (URL as any).createObjectURL = createFn;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (URL as any).revokeObjectURL = revokeFn;

      const cropper = new Kiri(container);
      const imgEl = container.querySelector("img") as HTMLImageElement;
      const blob = new Blob(["not a real image"], { type: "image/png" });
      // jsdom's Blob doesn't implement arrayBuffer() — polyfill just enough
      // for readExifOrientation() to run.
      (blob as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = () =>
        Promise.resolve(new ArrayBuffer(4));

      const loadPromise = cropper.load(blob);
      await Promise.resolve().then(() => Promise.resolve()); // let arrayBuffer()/EXIF parsing settle before .src is set
      imgEl.onerror?.(new Event("error"));

      await expect(loadPromise).rejects.toThrow(/failed to load image/);
      expect(createFn).toHaveBeenCalledWith(blob);
      expect(revokeFn).toHaveBeenCalledWith("blob:fake");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (URL as any).createObjectURL;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (URL as any).revokeObjectURL;
    });
  });

  describe("resizableFrame / lockAspectRatio", () => {
    function drag(handle: Element, dx: number, dy: number): void {
      // jsdom doesn't implement pointer capture.
      (handle as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {};
      handle.dispatchEvent(
        Object.assign(new Event("pointerdown"), { clientX: 0, clientY: 0, pointerId: 1 })
      );
      handle.dispatchEvent(
        Object.assign(new Event("pointermove"), { clientX: dx, clientY: dy, pointerId: 1 })
      );
    }

    it("creates four corner handles when resizableFrame is enabled", () => {
      new Kiri(container, { resizableFrame: true });
      expect(container.querySelectorAll(".kiri-frame-handle")).toHaveLength(4);
      expect(container.querySelector(".kiri-frame-handle--top-left")).not.toBeNull();
      expect(container.querySelector(".kiri-frame-handle--top-right")).not.toBeNull();
      expect(container.querySelector(".kiri-frame-handle--bottom-left")).not.toBeNull();
      expect(container.querySelector(".kiri-frame-handle--bottom-right")).not.toBeNull();
    });

    it("dragging the bottom-right handle grows both axes with the drag direction", () => {
      const cropper = new Kiri(container, { frame: { width: 100, height: 100 }, resizableFrame: true });
      const handle = container.querySelector(".kiri-frame-handle--bottom-right") as Element;

      drag(handle, 10, 5);

      expect(cropper.getState()).toBeDefined(); // state unaffected; check frame size instead
      const frame = container.querySelector(".kiri-frame") as HTMLElement;
      expect(frame.style.width).toBe("120px"); // 100 + 10*2
      expect(frame.style.height).toBe("110px"); // 100 + 5*2
    });

    it("dragging the top-left handle grows both axes when moving away from center", () => {
      const cropper = new Kiri(container, { frame: { width: 100, height: 100 }, resizableFrame: true });
      const handle = container.querySelector(".kiri-frame-handle--top-left") as Element;

      drag(handle, -10, -5);

      const frame = container.querySelector(".kiri-frame") as HTMLElement;
      expect(frame.style.width).toBe("120px");
      expect(frame.style.height).toBe("110px");
      expect(cropper).toBeDefined();
    });

    it("preserves aspect ratio when lockAspectRatio is enabled", () => {
      new Kiri(container, {
        frame: { width: 100, height: 200 }, // 1:2 aspect
        resizableFrame: true,
        lockAspectRatio: true,
      });
      const handle = container.querySelector(".kiri-frame-handle--bottom-right") as Element;

      drag(handle, 50, 0); // width-dominant drag

      const frame = container.querySelector(".kiri-frame") as HTMLElement;
      expect(frame.style.width).toBe("200px"); // 100 + 50*2
      expect(frame.style.height).toBe("400px"); // ratio preserved: 200 / (100/200)
    });

    it("removes all four handles on destroy", () => {
      const cropper = new Kiri(container, { resizableFrame: true });
      cropper.destroy();
      expect(container.querySelectorAll(".kiri-frame-handle")).toHaveLength(0);
    });
  });

  describe("keyboard accessibility", () => {
    it("marks the stage focusable and labeled", () => {
      new Kiri(container);
      const stage = container.querySelector(".kiri-stage") as HTMLElement;
      expect(stage.tabIndex).toBe(0);
      expect(stage.getAttribute("role")).toBe("application");
      expect(stage.getAttribute("aria-label")).toMatch(/crop/i);
    });

    it("arrow keys pan the view in the pressed direction (reveal more content on that side)", () => {
      const cropper = new Kiri(container, { frame: { width: 200, height: 150 }, maxZoom: 4 });
      (cropper as unknown as { naturalSize: { width: number; height: number } }).naturalSize = {
        width: 800,
        height: 600,
      };
      cropper.setZoom(2); // rendered (400x300) bigger than frame -> room to pan
      const stage = container.querySelector(".kiri-stage") as HTMLElement;

      // Pressing Right should reveal more of the image's right side, which
      // means the image content itself shifts left (offset.x decreases) —
      // the opposite sign from a rightward drag delta.
      stage.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
      expect(cropper.getState().offset.x).toBeLessThan(0);

      stage.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
      stage.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
      expect(cropper.getState().offset.x).toBeGreaterThan(0);

      // Pressing Down should reveal more of the image's bottom, i.e. the
      // image shifts up (offset.y decreases).
      stage.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
      expect(cropper.getState().offset.y).toBeLessThan(0);
    });

    it("+/- keys zoom in/out", () => {
      const cropper = new Kiri(container, { minZoom: 1, maxZoom: 4 });
      const stage = container.querySelector(".kiri-stage") as HTMLElement;

      stage.dispatchEvent(new KeyboardEvent("keydown", { key: "+" }));
      expect(cropper.getState().zoom).toBeCloseTo(1.1);

      stage.dispatchEvent(new KeyboardEvent("keydown", { key: "-" }));
      stage.dispatchEvent(new KeyboardEvent("keydown", { key: "-" }));
      expect(cropper.getState().zoom).toBe(1); // clamped at minZoom
    });

    it("0 key calls reset()", async () => {
      const cropper = new Kiri(container);
      const imgEl = container.querySelector("img") as HTMLImageElement;
      const loadPromise = cropper.load("fake.jpg", { zoom: 1 });
      imgEl.onload?.(new Event("load"));
      await loadPromise;

      cropper.setZoom(3);
      const stage = container.querySelector(".kiri-stage") as HTMLElement;
      stage.dispatchEvent(new KeyboardEvent("keydown", { key: "0" }));

      expect(cropper.getState().zoom).toBe(1);
    });
  });

  describe("invalid option values", () => {
    it("falls back to rectangle and warns on an invalid frame.shape", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      new Kiri(container, { frame: { shape: "circl" as never } });

      expect(container.querySelector(".kiri-frame--circle")).toBeNull();
      expect(container.querySelector(".kiri-frame")).not.toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/invalid frame\.shape "circl"/));

      warnSpy.mockRestore();
    });

    it("falls back to true and warns on an invalid mouseWheelZoom", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      new Kiri(container, { mouseWheelZoom: "ctrll" as never });

      expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/invalid mouseWheelZoom "ctrll"/));

      warnSpy.mockRestore();
    });

    it("accepts valid mouseWheelZoom values without warning", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      new Kiri(container, { mouseWheelZoom: "ctrl" });
      new Kiri(container, { mouseWheelZoom: false });

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("zoomer", () => {
    it("renders no zoomer by default", () => {
      new Kiri(container);
      expect(container.querySelector(".kiri-zoomer")).toBeNull();
      expect(container.querySelector(".kiri-root")).toBeNull();
    });

    it("renders a zoomer positioned bottom by default when enabled", () => {
      new Kiri(container, { showZoomer: true });
      expect(container.querySelector(".kiri-root--bottom")).not.toBeNull();
      const zoomer = container.querySelector(".kiri-zoomer") as HTMLInputElement;
      expect(zoomer).not.toBeNull();
      expect(zoomer.type).toBe("range");
    });

    it("falls back to bottom and warns on an invalid zoomerPosition", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      new Kiri(container, { showZoomer: true, zoomerPosition: "bttom" as never });

      expect(container.querySelector(".kiri-root--bottom")).not.toBeNull();
      expect(container.querySelector(".kiri-root--bttom")).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/invalid zoomerPosition "bttom"/));

      warnSpy.mockRestore();
    });

    it("positions the zoomer per zoomerPosition", () => {
      new Kiri(container, { showZoomer: true, zoomerPosition: "left" });
      expect(container.querySelector(".kiri-root--left")).not.toBeNull();
    });

    it("matches the zoomer's range to minZoom/maxZoom and initial zoom", () => {
      new Kiri(container, { showZoomer: true, minZoom: 1, maxZoom: 5 });
      const zoomer = container.querySelector(".kiri-zoomer") as HTMLInputElement;
      expect(zoomer.min).toBe("1");
      expect(zoomer.max).toBe("5");
      expect(zoomer.value).toBe("1");
    });

    it("dragging the zoomer calls setZoom (slider -> state)", () => {
      const cropper = new Kiri(container, { showZoomer: true, minZoom: 1, maxZoom: 4 });
      const zoomer = container.querySelector(".kiri-zoomer") as HTMLInputElement;

      zoomer.value = "3";
      zoomer.dispatchEvent(new Event("input"));

      expect(cropper.getState().zoom).toBe(3);
    });

    it("keeps the zoomer in sync when zoom changes programmatically (state -> slider)", () => {
      const cropper = new Kiri(container, { showZoomer: true, minZoom: 1, maxZoom: 4 });
      const zoomer = container.querySelector(".kiri-zoomer") as HTMLInputElement;

      cropper.setZoom(2.5);

      expect(zoomer.value).toBe("2.5");
    });

    it("removes the zoomer's listener on destroy", () => {
      const cropper = new Kiri(container, { showZoomer: true });
      const zoomer = container.querySelector(".kiri-zoomer") as HTMLInputElement;
      cropper.destroy();

      // container was cleared, so this dispatch hits a detached node — just
      // confirms destroy() doesn't throw and the container really is empty.
      zoomer.dispatchEvent(new Event("input"));
      expect(container.innerHTML).toBe("");
    });
  });
});
