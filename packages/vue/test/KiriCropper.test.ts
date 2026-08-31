import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref, type App } from "vue";
import { KiriCropper, type KiriCropperExposed } from "../src";

describe("KiriCropper (vue)", () => {
  let container: HTMLDivElement;
  let app: App | null = null;

  afterEach(() => {
    app?.unmount();
    app = null;
    container?.remove();
  });

  it("mounts a Kiri stage into the DOM and tears it down on unmount", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);

    app = createApp({
      render: () => h(KiriCropper, { frame: { shape: "circle", width: 100, height: 100 } }),
    });
    app.mount(container);
    await nextTick();

    expect(container.querySelector(".kiri-stage")).not.toBeNull();
    expect(container.querySelector(".kiri-frame--circle")).not.toBeNull();

    app.unmount();
    app = null;
    expect(container.querySelector(".kiri-stage")).toBeNull();
  });

  it("exposes the underlying Kiri instance's methods via a template ref", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const cropperRef = ref<KiriCropperExposed | null>(null);

    app = createApp({
      render: () => h(KiriCropper, { ref: cropperRef, minZoom: 1, maxZoom: 4 }),
    });
    app.mount(container);
    await nextTick();

    expect(cropperRef.value).not.toBeNull();
    cropperRef.value!.setZoom(2);
    expect(cropperRef.value!.getState().zoom).toBe(2);
  });

  it("emits change events", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const cropperRef = ref<KiriCropperExposed | null>(null);
    const seenZooms: number[] = [];

    app = createApp({
      render: () =>
        h(KiriCropper, {
          ref: cropperRef,
          onChange: (state: { zoom: number }) => seenZooms.push(state.zoom),
        }),
    });
    app.mount(container);
    await nextTick();

    cropperRef.value!.setZoom(3);
    expect(seenZooms).toEqual([3]);
  });

  it("applies filters prop changes live, without rebuilding the stage", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const cropperRef = ref<KiriCropperExposed | null>(null);
    const filters = ref({ brightness: 1 });

    app = createApp({
      render: () => h(KiriCropper, { ref: cropperRef, filters: filters.value }),
    });
    app.mount(container);
    await nextTick();
    const stageBefore = container.querySelector(".kiri-stage");

    filters.value = { brightness: 1.5 };
    await nextTick();

    expect(cropperRef.value!.getState().filters.brightness).toBe(1.5);
    expect(container.querySelector(".kiri-stage")).toBe(stageBefore); // no rebuild
  });

  it("rebuilds the stage and reloads the last source when a construction-only prop changes", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const cropperRef = ref<KiriCropperExposed | null>(null);
    const frame = ref({ width: 100, height: 100 });

    app = createApp({
      render: () => h(KiriCropper, { ref: cropperRef, frame: frame.value }),
    });
    app.mount(container);
    await nextTick();
    const stageBefore = container.querySelector(".kiri-stage");
    cropperRef.value!.load("data:image/png;base64,fake");

    frame.value = { width: 150, height: 150 };
    await nextTick();

    const frameEl = container.querySelector(".kiri-frame") as HTMLElement;
    expect(frameEl.style.width).toBe("150px");
    expect(container.querySelector(".kiri-stage")).not.toBe(stageBefore); // rebuilt
  });

  it("exposes setOffset/reset/getCropRegion", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const cropperRef = ref<KiriCropperExposed | null>(null);

    app = createApp({ render: () => h(KiriCropper, { ref: cropperRef }) });
    app.mount(container);
    await nextTick();

    expect(typeof cropperRef.value!.setOffset).toBe("function");
    expect(typeof cropperRef.value!.reset).toBe("function");
    expect(typeof cropperRef.value!.getCropRegion).toBe("function");
    expect(cropperRef.value!.getCropRegion()).toMatchObject({ rotation: 0 });
  });
});
