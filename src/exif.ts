/**
 * Reads the EXIF orientation tag (1-8) from a JPEG ArrayBuffer, defaulting to 1
 * (no adjustment) for images with no EXIF data or non-JPEG input.
 */
export function readExifOrientation(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return 1;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset, false);
    const size = view.getUint16(offset + 2, false);

    if (marker === 0xffe1) {
      const exifOffset = offset + 4;
      if (view.getUint32(exifOffset, false) !== 0x45786966) return 1; // "Exif"
      return readOrientationFromTiff(view, exifOffset + 6);
    }

    if ((marker & 0xff00) !== 0xff00) break;
    offset += 2 + size;
  }
  return 1;
}

function readOrientationFromTiff(view: DataView, tiffStart: number): number {
  const littleEndian = view.getUint16(tiffStart, false) === 0x4949;
  const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const ifdStart = tiffStart + firstIfdOffset;
  if (ifdStart + 2 > view.byteLength) return 1;

  const entryCount = view.getUint16(ifdStart, littleEndian);
  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdStart + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = view.getUint16(entryOffset, littleEndian);
    if (tag === 0x0112) {
      const value = view.getUint16(entryOffset + 8, littleEndian);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

/**
 * Maps an EXIF orientation value to a 90-degree rotation. Orientations that
 * also require mirroring (2, 4, 5, 7) are approximated by their closest
 * rotation-only equivalent, since Kiri does not support flipping in v1.
 */
export function orientationToRotation(orientation: number): number {
  switch (orientation) {
    case 6:
    case 5:
      return 90;
    case 3:
    case 4:
      return 180;
    case 8:
    case 7:
      return 270;
    default:
      return 0;
  }
}
