import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { CSSProperties } from "react";
import { Kiri } from "@michaelyagi/kiri";
import type {
  CropRegion,
  ExportOptions,
  ExportResult,
  Filters,
  KiriOptions,
  KiriState,
  LoadOptions,
  Offset,
  UploadOptions,
} from "@michaelyagi/kiri";

export interface KiriCropperProps {
  frame?: KiriOptions["frame"];
  minZoom?: number;
  maxZoom?: number;
  rotatable?: boolean;
  flippable?: boolean;
  resizableFrame?: boolean;
  lockAspectRatio?: boolean;
  mouseWheelZoom?: KiriOptions["mouseWheelZoom"];
  useExifOrientation?: boolean;
  filters?: Partial<Filters>;
  uploader?: KiriOptions["uploader"];
  onChange?: (state: KiriState) => void;
  className?: string;
  style?: CSSProperties;
}

export interface KiriCropperHandle {
  load: (source: File | Blob | string, options?: LoadOptions) => Promise<void>;
  getState: () => KiriState;
  setZoom: (zoom: number) => void;
  setOffset: (offset: Offset) => void;
  reset: () => void;
  rotate: (deltaDeg: number) => void;
  flipHorizontal: () => void;
  flipVertical: () => void;
  setFrameSize: (width: number, height: number) => void;
  setFilters: (filters: Partial<Filters>) => void;
  getCropRegion: () => CropRegion;
  export: (options?: ExportOptions) => Promise<ExportResult>;
  upload: (url: string, options?: UploadOptions) => Promise<unknown>;
}

// Options that only take effect at construction time (Kiri has no live
// setter for them) — changing any of these rebuilds the underlying Kiri
// instance and reloads whatever was last passed to load().
function constructionOptionsKey(props: KiriCropperProps): string {
  return JSON.stringify({
    frame: props.frame,
    minZoom: props.minZoom,
    maxZoom: props.maxZoom,
    rotatable: props.rotatable,
    flippable: props.flippable,
    resizableFrame: props.resizableFrame,
    lockAspectRatio: props.lockAspectRatio,
    mouseWheelZoom: props.mouseWheelZoom,
    useExifOrientation: props.useExifOrientation,
  });
}

/**
 * Thin pass-through: all cropping logic lives in the `kiri` core package.
 * This component owns the container ref and constructs/destroys the
 * underlying `Kiri` instance, forwarding its methods via the imperative
 * handle.
 *
 * Prop reactivity: `filters` is applied live via `setFilters()` on every
 * change — no rebuild. Every other option (`frame`, `minZoom`,
 * `resizableFrame`, etc.) has no live setter in core, so changing one
 * rebuilds the `Kiri` instance from scratch and automatically reloads
 * whatever source was last passed to the ref's `load()`.
 */
export const KiriCropper = forwardRef<KiriCropperHandle, KiriCropperProps>(function KiriCropper(
  props,
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cropperRef = useRef<Kiri | null>(null);
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;
  const uploaderRef = useRef(props.uploader);
  uploaderRef.current = props.uploader;
  const lastLoadRef = useRef<{ source: File | Blob | string; options?: LoadOptions } | null>(null);

  const optionsKey = constructionOptionsKey(props);

  useEffect(() => {
    if (!containerRef.current) return;

    const cropper = new Kiri(containerRef.current, {
      frame: props.frame,
      minZoom: props.minZoom,
      maxZoom: props.maxZoom,
      rotatable: props.rotatable,
      flippable: props.flippable,
      resizableFrame: props.resizableFrame,
      lockAspectRatio: props.lockAspectRatio,
      mouseWheelZoom: props.mouseWheelZoom,
      useExifOrientation: props.useExifOrientation,
      filters: props.filters,
      uploader: uploaderRef.current,
    });
    cropperRef.current = cropper;
    cropper.on("change", (state) => onChangeRef.current?.(state));

    if (lastLoadRef.current) {
      cropper.load(lastLoadRef.current.source, lastLoadRef.current.options);
    }

    return () => {
      cropper.destroy();
      cropperRef.current = null;
    };
    // Rebuild only when a construction-only option actually changes — not on
    // every render (props.frame etc. are typically new object literals).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey]);

  useEffect(() => {
    if (props.filters) cropperRef.current?.setFilters(props.filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(props.filters)]);

  useImperativeHandle(
    ref,
    () => ({
      load: (source, options) => {
        lastLoadRef.current = { source, options };
        return cropperRef.current!.load(source, options);
      },
      getState: () => cropperRef.current!.getState(),
      setZoom: (zoom) => cropperRef.current!.setZoom(zoom),
      setOffset: (offset) => cropperRef.current!.setOffset(offset),
      reset: () => cropperRef.current!.reset(),
      rotate: (deltaDeg) => cropperRef.current!.rotate(deltaDeg),
      flipHorizontal: () => cropperRef.current!.flipHorizontal(),
      flipVertical: () => cropperRef.current!.flipVertical(),
      setFrameSize: (width, height) => cropperRef.current!.setFrameSize(width, height),
      setFilters: (filters) => cropperRef.current!.setFilters(filters),
      getCropRegion: () => cropperRef.current!.getCropRegion(),
      export: (options) => cropperRef.current!.export(options),
      upload: (url, options) => cropperRef.current!.upload(url, options),
    }),
    []
  );

  return <div ref={containerRef} className={props.className} style={props.style} />;
});
