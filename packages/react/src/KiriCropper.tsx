import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { CSSProperties } from "react";
import { Kiri } from "@michaelyagi/kiri";
import type {
  ExportOptions,
  ExportResult,
  Filters,
  KiriOptions,
  KiriState,
  LoadOptions,
  UploadOptions,
} from "@michaelyagi/kiri";

export interface KiriCropperProps {
  frame?: KiriOptions["frame"];
  minZoom?: number;
  maxZoom?: number;
  rotatable?: boolean;
  flippable?: boolean;
  resizableFrame?: boolean;
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
  rotate: (deltaDeg: number) => void;
  flipHorizontal: () => void;
  flipVertical: () => void;
  setFrameSize: (width: number, height: number) => void;
  setFilters: (filters: Partial<Filters>) => void;
  export: (options?: ExportOptions) => Promise<ExportResult>;
  upload: (url: string, options?: UploadOptions) => Promise<unknown>;
}

/**
 * Thin pass-through: all cropping logic lives in the `kiri` core package.
 * This component only owns the container ref, constructs/destroys the
 * underlying `Kiri` instance, and forwards its methods via the imperative
 * handle. Constructor options are captured once on mount — to change them
 * later, use the ref's imperative methods (setZoom/rotate/setFilters/etc.)
 * rather than re-rendering with new props.
 */
export const KiriCropper = forwardRef<KiriCropperHandle, KiriCropperProps>(function KiriCropper(
  props,
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cropperRef = useRef<Kiri | null>(null);
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const cropper = new Kiri(containerRef.current, {
      frame: props.frame,
      minZoom: props.minZoom,
      maxZoom: props.maxZoom,
      rotatable: props.rotatable,
      flippable: props.flippable,
      resizableFrame: props.resizableFrame,
      mouseWheelZoom: props.mouseWheelZoom,
      useExifOrientation: props.useExifOrientation,
      filters: props.filters,
      uploader: props.uploader,
    });
    cropperRef.current = cropper;
    cropper.on("change", (state) => onChangeRef.current?.(state));

    return () => {
      cropper.destroy();
      cropperRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      load: (source, options) => cropperRef.current!.load(source, options),
      getState: () => cropperRef.current!.getState(),
      setZoom: (zoom) => cropperRef.current!.setZoom(zoom),
      rotate: (deltaDeg) => cropperRef.current!.rotate(deltaDeg),
      flipHorizontal: () => cropperRef.current!.flipHorizontal(),
      flipVertical: () => cropperRef.current!.flipVertical(),
      setFrameSize: (width, height) => cropperRef.current!.setFrameSize(width, height),
      setFilters: (filters) => cropperRef.current!.setFilters(filters),
      export: (options) => cropperRef.current!.export(options),
      upload: (url, options) => cropperRef.current!.upload(url, options),
    }),
    []
  );

  return <div ref={containerRef} className={props.className} style={props.style} />;
});
