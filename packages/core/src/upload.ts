import type { UploadOptions } from "./types";

/**
 * Default uploader: builds a FormData from the crop blob and POSTs it via
 * fetch. Swappable per-call (`UploadOptions.uploader`) or per-instance
 * (`KiriOptions.uploader`) for a custom protocol (presigned URLs, GraphQL,
 * etc.) while callers keep calling the same `cropper.upload(url, options)`.
 */
export async function uploadBlob(
  blob: Blob,
  options: UploadOptions & { url: string }
): Promise<Response> {
  const fieldName = options.fieldName ?? "file";
  const fileName = options.fileName ?? `crop.${extensionFor(options.format ?? "image/png")}`;

  const formData = new FormData();
  formData.append(fieldName, blob, fileName);
  for (const [key, value] of Object.entries(options.extraFields ?? {})) {
    formData.append(key, value);
  }

  return fetch(options.url, {
    ...options.fetchOptions,
    method: "POST",
    body: formData,
  });
}

function extensionFor(format: string): string {
  switch (format) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}
