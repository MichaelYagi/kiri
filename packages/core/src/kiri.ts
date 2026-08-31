import type {
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
import { exportCrop } from "./export";
import { DEFAULT_FILTERS, mergeFilters } from "./filters";
import { uploadBlob } from "./upload";

const DEFAULT_FRAME_SIZE = 200;
const MIN_FRAME_SIZE = 20;

interface ResolvedOptions {
  frame: { shape: FrameShape; width: number; height: number };
  minZoom: number;
  maxZoom: number;
  rotatable: boolean;
  flippable: boolean;
  resizableFrame: boolean;
  mouseWheelZoom: boolean | "ctrl";
  useExifOrientation: boolean;
  uploader: Uploader | undefined;
  autoSizeStage: boolean;
  showZoomer: boolean;
  zoomerPosition: ZoomerPosition;
}

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
  private listeners: Record<KiriEventName, KiriEventCallback[]> = { change: [] };

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
        shape: options.frame?.shape ?? "rect",
        width: options.frame?.width ?? DEFAULT_FRAME_SIZE,
        height: options.frame?.height ?? DEFAULT_FRAME_SIZE,
      },
      minZoom: options.minZoom ?? 1,
      maxZoom: options.maxZoom ?? 4,
      rotatable: options.rotatable ?? true,
      flippable: options.flippable ?? true,
      resizableFrame: options.resizableFrame ?? false,
      mouseWheelZoom: options.mouseWheelZoom ?? true,
      useExifOrientation: options.useExifOrientation ?? true,
      uploader: options.uploader,
      autoSizeStage: options.autoSizeStage ?? true,
      showZoomer: options.showZoomer ?? false,
      zoomerPosition: options.zoomerPosition ?? "bottom",
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
      },
      { mouseWheelZoom: this.opts.mouseWheelZoom }
    );

    if (this.opts.resizableFrame) this.enableFrameResize();
  }

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

    await new Promise<void>((resolve, reject) => {
      this.stage.imgEl.onload = () => resolve();
      this.stage.imgEl.onerror = () => reject(new Error("Kiri: failed to load image"));
      this.stage.imgEl.src = url;
    });

    if (objectUrl) URL.revokeObjectURL(objectUrl);

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
  }

  getState(): KiriState {
    return {
      zoom: this.state.zoom,
      offset: { ...this.state.offset },
      rotation: this.state.rotation,
      flip: { ...this.state.flip },
      filters: { ...this.state.filters },
    };
  }

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

  flipHorizontal(): void {
    if (!this.opts.flippable) return;
    const flip: Flip = { ...this.state.flip, horizontal: !this.state.flip.horizontal };
    this.commitState({ ...this.state, flip });
  }

  flipVertical(): void {
    if (!this.opts.flippable) return;
    const flip: Flip = { ...this.state.flip, vertical: !this.state.flip.vertical };
    this.commitState({ ...this.state, flip });
  }

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

  setFilters(filters: Partial<Filters>): void {
    this.commitState({ ...this.state, filters: mergeFilters(this.state.filters, filters) });
  }

  async export(options: ExportOptions = {}): Promise<ExportResult> {
    return exportCrop(this.stage.imgEl, this.state, this.getFrameSize(), options);
  }

  async upload(url: string, options: UploadOptions = {}): Promise<unknown> {
    const blob = (await this.export({ ...options, type: "blob" })) as Blob;
    const uploader = options.uploader ?? this.opts.uploader ?? uploadBlob;
    return uploader(blob, { ...options, url });
  }

  on(event: KiriEventName, callback: KiriEventCallback): void {
    this.listeners[event].push(callback);
  }

  off(event: KiriEventName, callback: KiriEventCallback): void {
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);
  }

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
    const handle = document.createElement("div");
    handle.className = "kiri-frame-handle";
    handle.style.right = "-5px";
    handle.style.bottom = "-5px";
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
      const dx = (e.clientX - start.x) * 2;
      const dy = (e.clientY - start.y) * 2;
      this.setFrameSize(start.width + dx, start.height + dy);
    };
    const onUp = (): void => {
      start = null;
    };

    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);

    this.resizeHandle = {
      destroy(): void {
        handle.removeEventListener("pointerdown", onDown);
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        handle.remove();
      },
    };
  }
}
