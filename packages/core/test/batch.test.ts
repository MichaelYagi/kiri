import { beforeEach, describe, expect, it, vi } from "vitest";
import { KiriBatch } from "../src/batch";

describe("KiriBatch", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("steps through queued items via next()/current(), loading each into the shared cropper", async () => {
    const batch = new KiriBatch(container, {}, [{ source: "a.png" }, { source: "b.png" }]);
    const loadSpy = vi.spyOn(batch.cropper, "load").mockResolvedValue(undefined);

    expect(batch.current()).toBeNull();

    expect(await batch.next()).toBe(true);
    expect(batch.current()).toEqual({ source: "a.png" });
    expect(loadSpy).toHaveBeenLastCalledWith("a.png", undefined);

    expect(await batch.next()).toBe(true);
    expect(batch.current()).toEqual({ source: "b.png" });
    expect(loadSpy).toHaveBeenLastCalledWith("b.png", undefined);

    expect(await batch.next()).toBe(false);
    expect(batch.current()).toEqual({ source: "b.png" }); // stays on the last item
  });

  it("supports add()ing items after construction", async () => {
    const batch = new KiriBatch(container);
    vi.spyOn(batch.cropper, "load").mockResolvedValue(undefined);

    expect(batch.length).toBe(0);
    batch.add({ source: "a.png" });
    expect(batch.length).toBe(1);

    expect(await batch.next()).toBe(true);
    expect(batch.current()).toEqual({ source: "a.png" });
  });

  it("captures exports indexed by item order via results()", async () => {
    const batch = new KiriBatch(container, {}, [{ source: "a.png" }, { source: "b.png" }]);
    vi.spyOn(batch.cropper, "load").mockResolvedValue(undefined);
    const exportSpy = vi
      .spyOn(batch.cropper, "export")
      .mockResolvedValueOnce("result-a")
      .mockResolvedValueOnce("result-b");

    await batch.next();
    await batch.capture();
    await batch.next();
    await batch.capture();

    expect(exportSpy).toHaveBeenCalledTimes(2);
    expect(batch.results()).toEqual(["result-a", "result-b"]);
  });

  it("steps backward through queued items via previous()", async () => {
    const batch = new KiriBatch(container, {}, [{ source: "a.png" }, { source: "b.png" }, { source: "c.png" }]);
    const loadSpy = vi.spyOn(batch.cropper, "load").mockResolvedValue(undefined);

    expect(await batch.previous()).toBe(false); // nothing loaded yet

    await batch.next();
    await batch.next();
    expect(batch.current()).toEqual({ source: "b.png" });

    expect(await batch.previous()).toBe(true);
    expect(batch.current()).toEqual({ source: "a.png" });
    expect(loadSpy).toHaveBeenLastCalledWith("a.png", undefined);

    expect(await batch.previous()).toBe(false); // already at the first item
    expect(batch.current()).toEqual({ source: "a.png" });
  });

  it("destroy() tears down the shared cropper", () => {
    const batch = new KiriBatch(container);
    const destroySpy = vi.spyOn(batch.cropper, "destroy");
    batch.destroy();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
