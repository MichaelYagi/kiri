import type {
  CropRegion,
  ExportOptions,
  ExportResult,
  Filters,
  Flip,
  FrameShape,
  KiriEventCallback,
  KiriEventName,
  KiriOptions,
  KiriState,
  LoadOptions,
  Offset,
  UploadOptions,
  Uploader,
  ZoomerPosition,
} from "./types";
import {
  applyFilters,
  applyTransform,
  createStage,
  setFrameSize as setStageFrameSize,
  setStageSize,
  STAGE_AUTO_SIZE_PADDING,
  type StageElements,
} from "./stage";
import {
  attachGestures,
  clampOffset,
  clampZoom,
  computeCoverScale,
  effectiveRenderedSize,
  normalizeRotation,
  type Size,
} from "./gestures";
import { orientationToTransform, readExifOrientation } from "./exif";
import { computeCropRegion, exportCrop } from "./export";
import { DEFAULT_FILTERS, mergeFilters } from "./filters";
import { uploadBlob } from "./upload";
import { resolveEnumOption } from "./validate";

const DEFAULT_FRAME_SIZE = 200;
const MIN_FRAME_SIZE = 20;
const VALID_FRAME_SHAPES: FrameShape[] = ["rectangle", "circle"];
const VALID_ZOOMER_POSITIONS: ZoomerPosition[] = ["top", "bottom", "left", "right"];

function resolveMouseWheelZoom(value: KiriOptions["mouseWheelZoom"]): boolean | "ctrl" {
  if (value === undefined) return true;
  if (typeof value === "boolean" || value === "ctrl") return value;
  console.warn(
    `Kiri: invalid mouseWheelZoom "${String(value)}" — defaulting to true. ` +
      `Valid values: true, false, "ctrl".`
  );
  return true;
}

interface ResolvedOptions {
  frame: { shape: FrameShape; width: number; height: number };
  minZoom: number;
  maxZoom: number;
  rotatable: boolean;
  flippable: boolean;
  resizableFrame: boolean;
  lockAspectRatio: boolean;
  mouseWheelZoom: boolean | "ctrl";
  useExifOrientation: boolean;
  uploader: Uploader | undefined;
  autoSizeStage: boolean;
  showZoomer: boolean;
  zoomerPosition: ZoomerPosition;
}

/**
 * An interactive image cropper attached to a plain DOM element. Drag to pan,
 * zoom via wheel/pinch/an optional built-in slider, rotate in 90° steps,
 * flip, apply filters, then export or upload the crop.
 */
export class Kiri {
  private readonly container: HTMLElement;
  private readonly opts: ResolvedOptions;
  private readonly stage: StageElements;
  private readonly gestureHandle: { destroy: () => void };
  private resizeHandle: { destroy: () => void } | null = null;
  private zoomerHandle: { destroy: () => void } | null = null;
  private naturalSize: Size = { width: 0, height: 0 };
  private state: KiriState = {
    zoom: 1,
    offset: { x: 0, y: 0 },
    rotation: 0,
    flip: { horizontal: false, vertical: false },
    filters: DEFAULT_FILTERS,
  };
  /** Snapshot taken right after `load()` resolves, so `reset()` has something to revert to. */
  private initialState: KiriState | null = null;
  private listeners: Record<KiriEventName, KiriEventCallback[]> = { change: [] };

  /**
   * @param container An element already present in the DOM. Passing
   * `null`/`undefined`, or an element that isn't in the DOM yet, throws.
   * @param options See the {@link KiriOptions} fields for defaults.
   */
  constructor(container: HTMLElement, options: KiriOptions = {}) {
    if (!container || typeof container.appendChild !== "function") {
      throw new Error(
        "Kiri: container element is null/undefined or not a DOM element. " +
          "This usually means the element wasn't in the DOM yet when " +
          "`new Kiri(...)` ran — e.g. document.getElementById() was called " +
          "before the element existed. Place the <script> after the " +
          "element, or construct inside a DOMContentLoaded listener."
      );
    }
    this.container = container;
    this.opts = {
      frame: {
        shape: resolveEnumOption(
          options.frame?.shape,
          VALID_FRAME_SHAPES,
          "rectangle",
          "frame.shape"
        ),
        width: options.frame?.width ?? DEFAULT_FRAME_SIZE,
        height: options.frame?.height ?? DEFAULT_FRAME_SIZE,
      },
      minZoom: options.minZoom ?? 1,
      maxZoom: options.maxZoom ?? 4,
      rotatable: options.rotatable ?? true,
      flippable: options.flippable ?? true,
      resizableFrame: options.resizableFrame ?? false,
      lockAspectRatio: options.lockAspectRatio ?? false,
      mouseWheelZoom: resolveMouseWheelZoom(options.mouseWheelZoom),
      useExifOrientation: options.useExifOrientation ?? true,
      uploader: options.uploader,
      autoSizeStage: options.autoSizeStage ?? true,
      showZoomer: options.showZoomer ?? false,
      zoomerPosition: resolveEnumOption(
        options.zoomerPosition,
        VALID_ZOOMER_POSITIONS,
        "bottom",
        "zoomerPosition"
      ),
    };
    this.state.filters = mergeFilters(DEFAULT_FILTERS, options.filters ?? {});

    this.stage = createStage(
      this.container,
      this.opts.frame.shape,
      this.opts.frame.width,
      this.opts.frame.height,
      {
        show: this.opts.showZoomer,
        position: this.opts.zoomerPosition,
        min: this.opts.minZoom,
        max: this.opts.maxZoom,
        value: this.state.zoom,
      }
    );
    if (this.opts.autoSizeStage) this.syncStageSize();
    applyFilters(this.stage.imgEl, this.state.filters);
    if (this.stage.zoomerEl) this.enableZoomer(this.stage.zoomerEl);

    this.gestureHandle = attachGestures(
      this.stage.stageEl,
      {
        getNaturalSize: () => this.naturalSize,
        getFrameSize: () => this.getFrameSize(),
        getState: () => this.state,
        getMinMaxZoom: () => ({ min: this.opts.minZoom, max: this.opts.maxZoom }),
        setState: (next) => this.commitState(next),
        reset: () => this.reset(),
      },
      { mouseWheelZoom: this.opts.mouseWheelZoom }
    );

    if (this.opts.resizableFrame) this.enableFrameResize();
  }

  /**
   * Loads an image, replacing whatever was loaded before. EXIF orientation
   * (rotation + horizontal flip) is corrected automatically unless
   * `useExifOrientation: false` was passed to the constructor — only for
   * `File`/`Blob` sources, since a plain URL string can't be read for EXIF
   * data without an extra fetch.
   * @param source A `File` (e.g. from a file input), a `Blob`, or a URL string.
   * @param loadOptions Initial `zoom`/`offset`/`rotation`/`flip`.
   */
  async load(source: File | Blob | string, loadOptions: LoadOptions = {}): Promise<void> {
    let rotation = normalizeRotation(loadOptions.rotation ?? 0);
    let flipHorizontal = loadOptions.flip?.horizontal ?? false;
    const flipVertical = loadOptions.flip?.vertical ?? false;
    let objectUrl: string | null = null;
    let url: string;

    if (typeof source === "string") {
      url = source;
    } else {
      if (this.opts.useExifOrientation) {
        const buffer = await source.arrayBuffer();
        const orientation = readExifOrientation(buffer);
        const exifTransform = orientationToTransform(orientation);
        rotation = normalizeRotation(rotation + exifTransform.rotation);
        // XOR: two horizontal flips (EXIF + a requested one) cancel out.
        flipHorizontal = flipHorizontal !== exifTransform.flipHorizontal;
      }
      objectUrl = URL.createObjectURL(source);
      url = objectUrl;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        this.stage.imgEl.onload = () => resolve();
        this.stage.imgEl.onerror = () => reject(new Error("Kiri: failed to load image"));
        this.stage.imgEl.src = url;
      });
    } finally {
      // Must run on the error path too, not just success — otherwise a
      // rejected load() (corrupt file, unsupported format) leaks the blob
      // URL for the rest of the page's lifetime.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }

    this.naturalSize = {
      width: this.stage.imgEl.naturalWidth,
      height: this.stage.imgEl.naturalHeight,
    };

    const zoom = clampZoom(
      loadOptions.zoom ?? this.opts.minZoom,
      this.opts.minZoom,
      this.opts.maxZoom
    );
    const rendered = effectiveRenderedSize(this.naturalSize, this.getFrameSize(), rotation, zoom);
    const offset = clampOffset(loadOptions.offset ?? { x: 0, y: 0 }, rendered, this.getFrameSize());

    this.commitState({
      zoom,
      offset,
      rotation,
      flip: { horizontal: flipHorizontal, vertical: flipVertical },
      filters: this.state.filters,
    });
    this.initialState = this.getState();
  }

  /** A snapshot of the current state — mutating the returned object has no effect. */
  getState(): KiriState {
    return {
      zoom: this.state.zoom,
      offset: { ...this.state.offset },
      rotation: this.state.rotation,
      flip: { ...this.state.flip },
      filters: { ...this.state.filters },
    };
  }

  /** Sets the zoom to an absolute value, clamped to `[minZoom, maxZoom]`. */
  setZoom(zoom: number): void {
    const clamped = clampZoom(zoom, this.opts.minZoom, this.opts.maxZoom);
    const rendered = effectiveRenderedSize(
      this.naturalSize,
      this.getFrameSize(),
      this.state.rotation,
      clamped
    );
    const offset = clampOffset(this.state.offset, rendered, this.getFrameSize());
    this.commitState({ ...this.state, zoom: clamped, offset });
  }

  /**
   * Sets the pan offset to an absolute value (image-center offset from the
   * frame center, in stage pixels), clamped so the frame stays fully covered
   * by the rendered image.
   */
  setOffset(offset: Offset): void {
    const rendered = effectiveRenderedSize(
      this.naturalSize,
      this.getFrameSize(),
      this.state.rotation,
      this.state.zoom
    );
    const clamped = clampOffset(offset, rendered, this.getFrameSize());
    this.commitState({ ...this.state, offset: clamped });
  }

  /**
   * Reverts zoom/offset/rotation/flip/filters to what they were right after
   * `load()` resolved (including any `loadOptions` passed to it). No-op if
   * nothing has been loaded yet.
   */
  reset(): void {
    if (!this.initialState) return;
    this.commitState({
      zoom: this.initialState.zoom,
      offset: { ...this.initialState.offset },
      rotation: this.initialState.rotation,
      flip: { ...this.initialState.flip },
      filters: { ...this.initialState.filters },
    });
  }

  /**
   * Rotates relative to the current rotation, snapped to the nearest 90°.
   * No-op if `rotatable: false` was passed to the constructor.
   */
  rotate(deltaDeg: number): void {
    if (!this.opts.rotatable) return;
    const snapped = Math.round(deltaDeg / 90) * 90;
    const rotation = normalizeRotation(this.state.rotation + snapped);
    const rendered = effectiveRenderedSize(
      this.naturalSize,
      this.getFrameSize(),
      rotation,
      this.state.zoom
    );
    const offset = clampOffset(this.state.offset, rendered, this.getFrameSize());
    this.commitState({ ...this.state, rotation, offset });
  }

  /** Toggles horizontal flip, independent of rotation. No-op if `flippable: false`. */
  flipHorizontal(): void {
    if (!this.opts.flippable) return;
    const flip: Flip = { ...this.state.flip, horizontal: !this.state.flip.horizontal };
    this.commitState({ ...this.state, flip });
  }

  /** Toggles vertical flip, independent of rotation. No-op if `flippable: false`. */
  flipVertical(): void {
    if (!this.opts.flippable) return;
    const flip: Flip = { ...this.state.flip, vertical: !this.state.flip.vertical };
    this.commitState({ ...this.state, flip });
  }

  /**
   * Resizes the frame. Also resizes the stage to match, if
   * `autoSizeStage: true` (the default). Each axis is clamped to a 20px
   * minimum.
   */
  setFrameSize(width: number, height: number): void {
    this.opts.frame.width = Math.max(MIN_FRAME_SIZE, width);
    this.opts.frame.height = Math.max(MIN_FRAME_SIZE, height);
    setStageFrameSize(this.stage.frameEl, this.opts.frame.width, this.opts.frame.height);
    if (this.opts.autoSizeStage) this.syncStageSize();
    const rendered = effectiveRenderedSize(
      this.naturalSize,
      this.getFrameSize(),
      this.state.rotation,
      this.state.zoom
    );
    const offset = clampOffset(this.state.offset, rendered, this.getFrameSize());
    this.commitState({ ...this.state, offset });
  }

  /**
   * Merges a partial update into the current filters (omitted fields are
   * left as they are). Numeric values are clamped to `>= 0`.
   */
  setFilters(filters: Partial<Filters>): void {
    this.commitState({ ...this.state, filters: mergeFilters(this.state.filters, filters) });
  }

  /**
   * Renders the current crop. A circle frame is a real clip in the output
   * (transparent corners on PNG/WebP); a circle exported as JPEG warns and
   * renders solid black corners instead, since JPEG has no alpha channel.
   * @returns A data URL string (`type: "base64"`, the default), a `Blob`, or an `HTMLCanvasElement`.
   */
  async export(options: ExportOptions = {}): Promise<ExportResult> {
    return exportCrop(
      this.stage.imgEl,
      this.state,
      this.getFrameSize(),
      this.opts.frame.shape,
      options
    );
  }

  /**
   * The current crop selection as a rectangle in the original, unrotated,
   * unflipped source image's own pixel coordinates — for sending to a server
   * that will crop the full-resolution original itself instead of uploading
   * a client-re-encoded image. See {@link CropRegion}.
   */
  getCropRegion(): CropRegion {
    return computeCropRegion(this.naturalSize, this.getFrameSize(), this.state);
  }

  /**
   * Exports the current crop as a blob, then uploads it — a default
   * FormData/`fetch` POST, or a custom `uploader` (per-call `options.uploader`
   * wins over the constructor's, which wins over the built-in default).
   */
  async upload(url: string, options: UploadOptions = {}): Promise<unknown> {
    const blob = (await this.export({ ...options, type: "blob" })) as Blob;
    const uploader = options.uploader ?? this.opts.uploader ?? uploadBlob;
    return uploader(blob, { ...options, url });
  }

  /** Subscribes to `"change"` — fires on every state update (drag/zoom/rotate/flip/filters), and once after `load()` resolves. */
  on(event: KiriEventName, callback: KiriEventCallback): void {
    this.listeners[event].push(callback);
  }

  /** Unsubscribes a callback previously passed to {@link on}. */
  off(event: KiriEventName, callback: KiriEventCallback): void {
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
  }

  /**
   * Tears the instance down: removes all pointer/wheel event listeners
   * (drag/zoom gestures), the resize-handle listener (if `resizableFrame`),
   * and the zoom-slider listener (if `showZoomer`); clears the container's
   * `innerHTML`, leaving an empty container element; and clears all
   * `"change"` listeners. Call this when you're done with an instance (e.g.
   * unmounting) to avoid leaking listeners.
   */
  destroy(): void {
    this.gestureHandle.destroy();
    this.resizeHandle?.destroy();
    this.zoomerHandle?.destroy();
    this.container.innerHTML = "";
    this.listeners.change = [];
  }

  private getFrameSize(): Size {
    return { width: this.opts.frame.width, height: this.opts.frame.height };
  }

  private syncStageSize(): void {
    setStageSize(
      this.stage.stageEl,
      this.opts.frame.width + STAGE_AUTO_SIZE_PADDING * 2,
      this.opts.frame.height + STAGE_AUTO_SIZE_PADDING * 2
    );
  }

  private commitState(next: KiriState): void {
    this.state = next;
    const scale =
      computeCoverScale(this.naturalSize, this.getFrameSize(), next.rotation) * next.zoom;
    applyTransform(this.stage.imageLayerEl, next, scale);
    applyFilters(this.stage.imgEl, next.filters);
    // Keeps the slider in sync regardless of what triggered the zoom change
    // (wheel, pinch, drag-clamping, or setZoom() itself) — setting .value
    // programmatically doesn't re-fire "input", so no feedback loop.
    if (this.stage.zoomerEl) this.stage.zoomerEl.value = String(next.zoom);
    for (const cb of this.listeners.change) cb(this.getState());
  }

  private enableZoomer(zoomerEl: HTMLInputElement): void {
    const onInput = (): void => this.setZoom(Number(zoomerEl.value));
    zoomerEl.addEventListener("input", onInput);
    this.zoomerHandle = {
      destroy(): void {
        zoomerEl.removeEventListener("input", onInput);
      },
    };
  }

  private enableFrameResize(): void {
    // Corners named by which edges they sit on; signX/signY say which way
    // dragging that corner should grow the frame on each axis. The frame is
    // always centered in the stage (kiri.css), so moving any one corner by
    // `d` pixels grows/shrinks that axis by `2*d` to keep the opposite edge
    // stationary and make the drag feel corner-anchored.
    const corners: { name: string; edge: { left?: string; right?: string; top?: string; bottom?: string }; signX: number; signY: number }[] = [
      { name: "top-left", edge: { left: "-5px", top: "-5px" }, signX: -1, signY: -1 },
      { name: "top-right", edge: { right: "-5px", top: "-5px" }, signX: 1, signY: -1 },
      { name: "bottom-left", edge: { left: "-5px", bottom: "-5px" }, signX: -1, signY: 1 },
      { name: "bottom-right", edge: { right: "-5px", bottom: "-5px" }, signX: 1, signY: 1 },
    ];

    const cleanups: (() => void)[] = [];

    for (const corner of corners) {
      const handle = document.createElement("div");
      handle.className = `kiri-frame-handle kiri-frame-handle--${corner.name}`;
      Object.assign(handle.style, corner.edge);
      this.stage.frameEl.appendChild(handle);

      let start: { x: number; y: number; width: number; height: number } | null = null;

      const onDown = (e: PointerEvent): void => {
        e.stopPropagation();
        handle.setPointerCapture(e.pointerId);
        start = {
          x: e.clientX,
          y: e.clientY,
          width: this.opts.frame.width,
          height: this.opts.frame.height,
        };
      };
      const onMove = (e: PointerEvent): void => {
        if (!start) return;
        const dx = (e.clientX - start.x) * 2 * corner.signX;
        const dy = (e.clientY - start.y) * 2 * corner.signY;
        const rawWidth = start.width + dx;
        const rawHeight = start.height + dy;

        if (this.opts.lockAspectRatio) {
          const aspect = start.width / start.height;
          // Whichever axis moved more (in aspect-normalized units) drives
          // the resize; the other axis follows to preserve the ratio.
          if (Math.abs(rawWidth - start.width) >= Math.abs(rawHeight - start.height) * aspect) {
            this.setFrameSize(rawWidth, rawWidth / aspect);
          } else {
            this.setFrameSize(rawHeight * aspect, rawHeight);
          }
        } else {
          this.setFrameSize(rawWidth, rawHeight);
        }
      };
      const onUp = (): void => {
        start = null;
      };

      handle.addEventListener("pointerdown", onDown);
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);

      cleanups.push(() => {
        handle.removeEventListener("pointerdown", onDown);
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        handle.remove();
      });
    }

    this.resizeHandle = {
      destroy(): void {
        for (const cleanup of cleanups) cleanup();
      },
    };
  }
}
