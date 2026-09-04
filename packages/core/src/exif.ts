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

export interface OrientationTransform {
  rotation: number;
  flipHorizontal: boolean;
}

/**
 * Maps an EXIF orientation value to the rotation + horizontal-flip pair that
 * normalizes it. A vertical flip is never needed on its own: orientation 4
 * (mirror vertical) is expressed as rotate(180) + flip horizontal, which is
 * mathematically equivalent.
 *
 * Rotation and flip don't commute, so which rotation value is paired with
 * `flipHorizontal: true` depends on Kiri's actual render order: rotation is
 * applied first, then flip mirrors the already-rotated result (see
 * stage.ts's `applyTransform()`). That's why orientations 5 and 7 use `270`/
 * `90` here rather than the more "obvious" `90`/`270` — reflections invert
 * the effective rotation direction (`flip · rotate(θ) = rotate(-θ) · flip`),
 * so producing the correct final image under this render order needs the
 * negated angle. Orientations 2/3/4/6/8 are unaffected: 2 and 4 have no
 * rotation-order ambiguity (0° and 180° are their own negation mod 360), and
 * 3/6/8 have no flip at all. Verified directly (not just by this algebra) —
 * confirmed in a real browser that `rotate(270) + flipHorizontal` under the
 * current render order reproduces the exact same pixels as
 * `rotate(90) + flipHorizontal` did under the old (flip-before-rotate) order,
 * and vice versa.
 */
export function orientationToTransform(orientation: number): OrientationTransform {
  switch (orientation) {
    case 2:
      return { rotation: 0, flipHorizontal: true };
    case 3:
      return { rotation: 180, flipHorizontal: false };
    case 4:
      return { rotation: 180, flipHorizontal: true };
    case 5:
      return { rotation: 270, flipHorizontal: true };
    case 6:
      return { rotation: 90, flipHorizontal: false };
    case 7:
      return { rotation: 90, flipHorizontal: true };
    case 8:
      return { rotation: 270, flipHorizontal: false };
    default:
      return { rotation: 0, flipHorizontal: false };
  }
}
