import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadBlob } from "../src/upload";
import { Kiri } from "../src/kiri";

describe("uploadBlob", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs a FormData with the blob under the default field/file names", async () => {
    const blob = new Blob(["fake-png-bytes"], { type: "image/png" });
    await uploadBlob(blob, { url: "https://example.com/upload" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/upload");
    expect(init.method).toBe("POST");

    const formData = init.body as FormData;
    const file = formData.get("file") as File;
    expect(file.name).toBe("crop.png");
  });

  it("honors custom field name, file name, extra fields, and format-based extension", async () => {
    const blob = new Blob(["jpeg-bytes"], { type: "image/jpeg" });
    await uploadBlob(blob, {
      url: "https://example.com/upload",
      fieldName: "avatar",
      format: "image/jpeg",
      extraFields: { userId: "42" },
    });

    const [, init] = fetchMock.mock.calls[0];
    const formData = init.body as FormData;
    expect(formData.get("avatar")).toBeInstanceOf(File);
    expect((formData.get("avatar") as File).name).toBe("crop.jpg");
    expect(formData.get("userId")).toBe("42");
  });
});

describe("Kiri.upload", () => {
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports the current crop as a blob and uploads it via the default uploader", async () => {
    const cropper = new Kiri(container);
    const fakeBlob = new Blob(["x"], { type: "image/png" });
    vi.spyOn(cropper, "export").mockResolvedValue(fakeBlob);

    await cropper.upload("https://example.com/upload");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/upload");
  });

  it("delegates to a per-instance custom uploader instead of fetch", async () => {
    const customUploader = vi.fn().mockResolvedValue("custom-result");
    const cropper = new Kiri(container, { uploader: customUploader });
    const fakeBlob = new Blob(["x"], { type: "image/png" });
    vi.spyOn(cropper, "export").mockResolvedValue(fakeBlob);

    const result = await cropper.upload("https://example.com/upload");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(customUploader).toHaveBeenCalledWith(
      fakeBlob,
      expect.objectContaining({ url: "https://example.com/upload" })
    );
    expect(result).toBe("custom-result");
  });

  it("a per-call uploader overrides the per-instance one", async () => {
    const instanceUploader = vi.fn().mockResolvedValue("instance-result");
    const callUploader = vi.fn().mockResolvedValue("call-result");
    const cropper = new Kiri(container, { uploader: instanceUploader });
    vi.spyOn(cropper, "export").mockResolvedValue(new Blob(["x"]));

    const result = await cropper.upload("https://example.com/upload", { uploader: callUploader });

    expect(instanceUploader).not.toHaveBeenCalled();
    expect(callUploader).toHaveBeenCalled();
    expect(result).toBe("call-result");
  });
});
