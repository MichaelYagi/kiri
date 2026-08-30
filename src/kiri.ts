import type {
  ExportOptions,
  ExportResult,
  FrameShape,
  KiriEventCallback,
  KiriEventName,
  KiriOptions,
  KiriState,
  LoadOptions,
} from "./types";
import {
  applyTransform,
  createStage,
  setFrameSize as setStageFrameSize,
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
import { orientationToRotation, readExifOrientation } from "./exif";
import { exportCrop } from "./export";

const DEFAULT_FRAME_SIZE = 200;
const MIN_FRAME_SIZE = 20;

interface ResolvedOptions {
  frame: { shape: FrameShape; width: number; height: number };
  minZoom: number;
  maxZoom: number;
  rotatable: boolean;
  resizableFrame: boolean;
  mouseWheelZoom: boolean | "ctrl";
  useExifOrientation: boolean;
}

export class Kiri {
  private readonly container: HTMLElement;
  private readonly opts: ResolvedOptions;
  private readonly stage: StageElements;
  private readonly gestureHandle: { destroy: () => void };
  private resizeHandle: { destroy: () => void } | null = null;
  private naturalSize: Size = { width: 0, height: 0 };
  private state: KiriState = { zoom: 1, offset: { x: 0, y: 0 }, rotation: 0 };
  private listeners: Record<KiriEventName, KiriEventCallback[]> = { change: [] };

  constructor(container: HTMLElement, options: KiriOptions = {}) {
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
      resizableFrame: options.resizableFrame ?? false,
      mouseWheelZoom: options.mouseWheelZoom ?? true,
      useExifOrientation: options.useExifOrientation ?? true,
    };

    this.stage = createStage(
      this.container,
      this.opts.frame.shape,
      this.opts.frame.width,
      this.opts.frame.height
    );

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
    let objectUrl: string | null = null;
    let url: string;

    if (typeof source === "string") {
      url = source;
    } else {
      if (this.opts.useExifOrientation) {
        const buffer = await source.arrayBuffer();
        const orientation = readExifOrientation(buffer);
        rotation = normalizeRotation(rotation + orientationToRotation(orientation));
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

    this.commitState({ zoom, offset, rotation });
  }

  getState(): KiriState {
    return {
      zoom: this.state.zoom,
      offset: { ...this.state.offset },
      rotation: this.state.rotation,
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

  setFrameSize(width: number, height: number): void {
    this.opts.frame.width = Math.max(MIN_FRAME_SIZE, width);
    this.opts.frame.height = Math.max(MIN_FRAME_SIZE, height);
    setStageFrameSize(this.stage.frameEl, this.opts.frame.width, this.opts.frame.height);
    const rendered = effectiveRenderedSize(
      this.naturalSize,
      this.getFrameSize(),
      this.state.rotation,
      this.state.zoom
    );
    const offset = clampOffset(this.state.offset, rendered, this.getFrameSize());
    this.commitState({ ...this.state, offset });
  }

  async export(options: ExportOptions = {}): Promise<ExportResult> {
    return exportCrop(this.stage.imgEl, this.state, this.getFrameSize(), options);
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
    this.container.innerHTML = "";
    this.listeners.change = [];
  }

  private getFrameSize(): Size {
    return { width: this.opts.frame.width, height: this.opts.frame.height };
  }

  private commitState(next: KiriState): void {
    this.state = next;
    const scale =
      computeCoverScale(this.naturalSize, this.getFrameSize(), next.rotation) * next.zoom;
    applyTransform(this.stage.imageLayerEl, next, scale);
    for (const cb of this.listeners.change) cb(this.getState());
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
