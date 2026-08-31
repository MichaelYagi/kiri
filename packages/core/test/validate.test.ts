import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveEnumOption } from "../src/validate";

describe("resolveEnumOption", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the fallback silently when the value is undefined", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveEnumOption(undefined, ["a", "b"], "a", "thing")).toBe("a");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("passes a valid value through unchanged", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveEnumOption("b", ["a", "b"], "a", "thing")).toBe("b");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("warns and falls back on an invalid value", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(resolveEnumOption("c" as never, ["a", "b"], "a", "thing")).toBe("a");
    expect(warnSpy).toHaveBeenCalledWith(
      'Kiri: invalid thing "c" — defaulting to "a". Valid values: a, b.'
    );
  });
});
