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
});
