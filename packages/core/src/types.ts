export type FrameShape = "rectangle" | "circle" | "rounded-rectangle";
export type ZoomerPosition = "top" | "bottom" | "left" | "right";

export interface FrameSize {
  width: number;
  height: number;
}

export interface Offset {
  x: number;
  y: number;
}

export interface Flip {
  horizontal: boolean;
  vertical: boolean;
}

/**
 * Brightness/contrast/saturation are `>= 0`, where `1` means unchanged.
 * `sharpness` is also `>= 0`, but unlike the others `1` (or below) means
 * *no* sharpening — values above `1` increase sharpening strength.
 */
export interface Filters {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  grayscale: boolean;
  sepia: boolean;
}

/** A custom upload implementation, for `KiriOptions.uploader` or `UploadOptions.uploader`. */
export type Uploader = (
  blob: Blob,
  options: UploadOptions & { url: string }
) => Promise<unknown>;

export interface KiriOptions {
  frame?: {
    /**
     * Default `"rectangle"`. `"circle"` and `"rounded-rectangle"` are real
     * clips on export, not just a visual overlay.
     */
    shape?: FrameShape;
    /** Pixels. Default `200`. */
    width?: number;
    /** Pixels. Default `200`. */
    height?: number;
    /** Corner radius in pixels. Only used when `shape` is `"rounded-rectangle"`. Default `20`. */
    cornerRadius?: number;
  };
  /** Default `1`. */
  minZoom?: number;
  /** Default `4`. */
  maxZoom?: number;
  /** Default `true`. */
  rotatable?: boolean;
  /** Default `true`. */
  flippable?: boolean;
  /** Adds drag handles at all four frame corners. Default `false`. */
  resizableFrame?: boolean;
  /**
   * When `resizableFrame` is on, dragging a corner handle preserves the
   * frame's current aspect ratio (the ratio it had when the drag started)
   * instead of resizing width/height independently. Default `false`.
   */
  lockAspectRatio?: boolean;
  /**
   * Inverts which element is interactive. By default the image pans/zooms
   * while the frame stays fixed. When `movableFrame` is `true`, the image
   * is displayed at a fixed size and never pans or zooms — instead,
   * dragging (or arrow keys) moves the *frame* around the static image, and
   * (combine with `resizableFrame`) its corner handles resize it, clamped
   * to the image's own bounds. `setZoom()`/`setOffset()` become no-ops in
   * this mode (nothing to pan/zoom); use `setFramePosition()` instead.
   * `rotate()`/flip still work — they transform the whole static image in
   * place. Default `false`.
   */
  movableFrame?: boolean;
  /** `"ctrl"` requires holding Ctrl while scrolling to zoom. Default `true`. */
  mouseWheelZoom?: boolean | "ctrl";
  /** Corrects rotation + horizontal flip from EXIF data on `File`/`Blob` sources. Default `true`. */
  useExifOrientation?: boolean;
  /** Initial filter values; see {@link Filters}. */
  filters?: Partial<Filters>;
  /** A custom upload implementation, used by `upload()` unless overridden per-call. */
  uploader?: Uploader;
  /**
   * When true (default), the stage sizes itself to the frame's dimensions
   * (plus a small margin) so it looks right with zero CSS. Set false to
   * have the stage fill its container instead (100% width/height) — for
   * embedding in a layout where you want to control the stage's size via
   * your own CSS on the container element.
   */
  autoSizeStage?: boolean;
  /** Renders a built-in zoom slider, kept in sync with wheel/pinch/setZoom() in both directions. Default false. */
  showZoomer?: boolean;
  /** Where the zoom slider sits relative to the stage. Purely a placement choice — identical behavior in every position. Default "bottom". */
  zoomerPosition?: ZoomerPosition;
}

/** The full mutable state of a `Kiri` instance, as returned by `getState()`. */
export interface KiriState {
  zoom: number;
  offset: Offset;
  rotation: number;
  flip: Flip;
  filters: Filters;
  /**
   * The frame's position, offset from stage center. Only meaningful when
   * `movableFrame: true` — always `{ x: 0, y: 0 }` otherwise, since the
   * frame stays centered in the default (image pans/zooms) mode.
   */
  framePosition: Offset;
}

/** Options for `load()`. */
export interface LoadOptions {
  /**
   * Clamped to `[minZoom, maxZoom]`. Default `minZoom`. Ignored when
   * `movableFrame: true` — the image always renders at its fixed size from
   * the first frame, same as `setZoom()` being a no-op in that mode.
   */
  zoom?: number;
  /**
   * Clamped so the frame stays covered by the image. Default `{ x: 0, y: 0 }`.
   * Ignored when `movableFrame: true`, same as `zoom` above.
   */
  offset?: Offset;
  /** Degrees, snapped to the nearest 90°. Default `0`. */
  rotation?: number;
  /** Default `{ horizontal: false, vertical: false }`. */
  flip?: Partial<Flip>;
}

export type ExportType = "base64" | "blob" | "canvas";
export type ExportFormat = "image/jpeg" | "image/png" | "image/webp";

/** Options for `export()`. */
export interface ExportOptions {
  /** Default `"base64"` (a data URL string). */
  type?: ExportType;
  /** Default `"image/png"`. A circle frame exported as `"image/jpeg"` warns — JPEG has no alpha channel. */
  format?: ExportFormat;
  /** `0`-`1`. Only meaningful for `"image/jpeg"`/`"image/webp"`. Default: browser default. */
  quality?: number;
  /** Output pixel width. Default: the frame's width. */
  width?: number;
  /** Output pixel height. Default: the frame's height. */
  height?: number;
}

/** Options for `upload()` — everything `export()` takes, plus these. */
export interface UploadOptions extends ExportOptions {
  /** The FormData field name. Default `"file"`. */
  fieldName?: string;
  /** Default: `"crop.<ext>"`, extension derived from `format`. */
  fileName?: string;
  /** Extra FormData fields to send alongside the file. Default `{}`. */
  extraFields?: Record<string, string>;
  /** Merged into the underlying `fetch()` call (method/body are always overridden). Default `{}`. */
  fetchOptions?: RequestInit;
  /** Overrides the constructor's `uploader` for this call only. */
  uploader?: Uploader;
}

export type ExportResult = string | Blob | HTMLCanvasElement;

/**
 * The current crop selection expressed as a rectangle in the *original,
 * unrotated, unflipped* source image's own pixel coordinates — for sending
 * to a server that will crop the full-resolution original itself, instead
 * of uploading a client-re-encoded image. `rotation`/`flip` are included so
 * the server can reproduce the full transform: crop to `x`/`y`/`width`/
 * `height` first (that rectangle is already expressed in the original,
 * untransformed image's own coordinates), then rotate, then flip, in that
 * order — matching how Kiri itself composes them (rotation first, flip
 * applied to the already-rotated result, so flip always mirrors what was
 * *displayed*, not the original image's own pre-rotation axes) — and get an
 * identical result to what the user saw. See `getCropRegion()`.
 */
export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  flip: Flip;
}

export type KiriEventName = "change";
/** Receives the same snapshot `getState()` returns. */
export type KiriEventCallback = (state: KiriState) => void;
