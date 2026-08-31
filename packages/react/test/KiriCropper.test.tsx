import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { KiriCropper, type KiriCropperHandle } from "../src";

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

describe("KiriCropper", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container?.remove();
  });

  it("mounts a Kiri stage into the DOM and tears it down on unmount", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<KiriCropper frame={{ shape: "circle", width: 100, height: 100 }} />);
    });

    expect(container.querySelector(".kiri-stage")).not.toBeNull();
    expect(container.querySelector(".kiri-frame--circle")).not.toBeNull();

    await act(async () => {
      root.unmount();
    });

    expect(container.querySelector(".kiri-stage")).toBeNull();
  });

  it("exposes the underlying Kiri instance's methods via the imperative ref", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const ref = createRef<KiriCropperHandle>();

    await act(async () => {
      root.render(<KiriCropper ref={ref} minZoom={1} maxZoom={4} />);
    });

    expect(ref.current).not.toBeNull();
    ref.current!.setZoom(2);
    expect(ref.current!.getState().zoom).toBe(2);
  });

  it("forwards state changes to onChange", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const ref = createRef<KiriCropperHandle>();
    const seenZooms: number[] = [];

    await act(async () => {
      root.render(<KiriCropper ref={ref} onChange={(state) => seenZooms.push(state.zoom)} />);
    });

    act(() => {
      ref.current!.setZoom(3);
    });

    expect(seenZooms).toEqual([3]);
  });

  it("applies filters prop changes live, without rebuilding the stage", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const ref = createRef<KiriCropperHandle>();

    await act(async () => {
      root.render(<KiriCropper ref={ref} filters={{ brightness: 1 }} />);
    });
    const stageBefore = container.querySelector(".kiri-stage");

    await act(async () => {
      root.render(<KiriCropper ref={ref} filters={{ brightness: 1.5 }} />);
    });

    expect(ref.current!.getState().filters.brightness).toBe(1.5);
    expect(container.querySelector(".kiri-stage")).toBe(stageBefore); // same DOM node -> no rebuild
  });

  it("rebuilds the stage and reloads the last source when a construction-only prop changes", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const ref = createRef<KiriCropperHandle>();

    await act(async () => {
      root.render(<KiriCropper ref={ref} frame={{ width: 100, height: 100 }} />);
    });
    const stageBefore = container.querySelector(".kiri-stage");
    ref.current!.load("data:image/png;base64,fake");

    await act(async () => {
      root.render(<KiriCropper ref={ref} frame={{ width: 150, height: 150 }} />);
    });

    const frame = container.querySelector(".kiri-frame") as HTMLElement;
    expect(frame.style.width).toBe("150px");
    expect(container.querySelector(".kiri-stage")).not.toBe(stageBefore); // rebuilt
  });

  it("exposes setOffset/reset/getCropRegion", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const ref = createRef<KiriCropperHandle>();

    await act(async () => {
      root.render(<KiriCropper ref={ref} />);
    });

    expect(typeof ref.current!.setOffset).toBe("function");
    expect(typeof ref.current!.reset).toBe("function");
    expect(typeof ref.current!.getCropRegion).toBe("function");
    expect(ref.current!.getCropRegion()).toMatchObject({ rotation: 0 });
  });
});
