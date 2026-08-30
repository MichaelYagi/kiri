import { describe, expect, it } from "vitest";
import { orientationToRotation, readExifOrientation } from "../src/exif";

/**
 * Builds a minimal synthetic JPEG byte buffer containing just enough of an
 * APP1/Exif/TIFF structure to carry a single orientation tag, so the parser
 * can be tested without shipping a binary fixture file.
 */
function buildJpegWithOrientation(orientation: number): ArrayBuffer {
  const bytes: number[] = [];
  bytes.push(0xff, 0xd8); // SOI

  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  const tiffHeader = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]; // "II", 42, IFD offset 8
  const ifdEntryCount = [0x01, 0x00];
  const entry = [
    0x12,
    0x01, // tag 0x0112 (orientation)
    0x03,
    0x00, // type SHORT
    0x01,
    0x00,
    0x00,
    0x00, // count 1
    orientation & 0xff,
    0x00,
    0x00,
    0x00, // value + padding
  ];
  const nextIfdOffset = [0x00, 0x00, 0x00, 0x00];

  const payload = [...exifHeader, ...tiffHeader, ...ifdEntryCount, ...entry, ...nextIfdOffset];
  const size = 2 + payload.length;

  bytes.push(0xff, 0xe1); // APP1 marker
  bytes.push((size >> 8) & 0xff, size & 0xff);
  bytes.push(...payload);

  return new Uint8Array(bytes).buffer;
}

describe("readExifOrientation", () => {
  it("returns 1 for a non-JPEG buffer", () => {
    const buffer = new Uint8Array([0, 1, 2, 3]).buffer;
    expect(readExifOrientation(buffer)).toBe(1);
  });

  it("returns 1 for a JPEG with no APP1/Exif segment", () => {
    const buffer = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer; // SOI + EOI only
    expect(readExifOrientation(buffer)).toBe(1);
  });

  it.each([1, 3, 6, 8])("reads orientation tag %i from a synthetic EXIF buffer", (orientation) => {
    const buffer = buildJpegWithOrientation(orientation);
    expect(readExifOrientation(buffer)).toBe(orientation);
  });
});

describe("orientationToRotation", () => {
  it("maps orientation values to their closest rotation-only equivalent", () => {
    expect(orientationToRotation(1)).toBe(0);
    expect(orientationToRotation(3)).toBe(180);
    expect(orientationToRotation(6)).toBe(90);
    expect(orientationToRotation(8)).toBe(270);
  });
});
