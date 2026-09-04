import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch, type PropType } from "vue";
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

export interface KiriCropperExposed {
  load: (source: File | Blob | string, options?: LoadOptions) => Promise<void>;
  getState: () => KiriState;
  setZoom: (zoom: number) => void;
  setOffset: (offset: Offset) => void;
  setFramePosition: (position: Offset) => void;
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

/**
 * Thin pass-through: all cropping logic lives in the `kiri` core package.
 * This component owns the container ref and constructs/destroys the
 * underlying `Kiri` instance, exposing its methods on the component
 * instance (via a template ref).
 *
 * Prop reactivity: `filters` is applied live via `setFilters()` on every
 * change — no rebuild. Every other prop (`frame`, `minZoom`,
 * `resizableFrame`, etc.) has no live setter in core, so changing one
 * rebuilds the `Kiri` instance from scratch and automatically reloads
 * whatever source was last passed to the exposed `load()`.
 */
export const KiriCropper = defineComponent({
  name: "KiriCropper",
  props: {
    frame: { type: Object as PropType<KiriOptions["frame"]>, default: undefined },
    minZoom: { type: Number, default: undefined },
    maxZoom: { type: Number, default: undefined },
    rotatable: { type: Boolean, default: undefined },
    flippable: { type: Boolean, default: undefined },
    resizableFrame: { type: Boolean, default: undefined },
    lockAspectRatio: { type: Boolean, default: undefined },
    movableFrame: { type: Boolean, default: undefined },
    mouseWheelZoom: {
      type: [Boolean, String] as PropType<KiriOptions["mouseWheelZoom"]>,
      default: undefined,
    },
    useExifOrientation: { type: Boolean, default: undefined },
    filters: { type: Object as PropType<Partial<Filters>>, default: undefined },
    uploader: { type: Function as PropType<KiriOptions["uploader"]>, default: undefined },
  },
  emits: ["change"],
  setup(props, { expose, emit }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let cropper: Kiri | null = null;
    let lastLoad: { source: File | Blob | string; options?: LoadOptions } | null = null;

    function build(): void {
      if (!containerRef.value) return;
      cropper?.destroy();
      cropper = new Kiri(containerRef.value, {
        frame: props.frame,
        minZoom: props.minZoom,
        maxZoom: props.maxZoom,
        rotatable: props.rotatable,
        flippable: props.flippable,
        resizableFrame: props.resizableFrame,
        lockAspectRatio: props.lockAspectRatio,
        movableFrame: props.movableFrame,
        mouseWheelZoom: props.mouseWheelZoom,
        useExifOrientation: props.useExifOrientation,
        filters: props.filters,
        uploader: props.uploader,
      });
      cropper.on("change", (state) => emit("change", state));
      if (lastLoad) cropper.load(lastLoad.source, lastLoad.options);
    }

    onMounted(build);

    watch(
      () => [
        props.frame,
        props.minZoom,
        props.maxZoom,
        props.rotatable,
        props.flippable,
        props.resizableFrame,
        props.lockAspectRatio,
        props.movableFrame,
        props.mouseWheelZoom,
        props.useExifOrientation,
      ],
      () => {
        if (cropper) build(); // skip the pre-mount firing; onMounted handles the first build
      },
      { deep: true }
    );

    watch(
      () => props.filters,
      (filters) => {
        if (filters) cropper?.setFilters(filters);
      },
      { deep: true }
    );

    onBeforeUnmount(() => {
      cropper?.destroy();
      cropper = null;
    });

    const exposed: KiriCropperExposed = {
      load: (source, options) => {
        lastLoad = { source, options };
        return cropper!.load(source, options);
      },
      getState: () => cropper!.getState(),
      setZoom: (zoom) => cropper!.setZoom(zoom),
      setOffset: (offset) => cropper!.setOffset(offset),
      setFramePosition: (position) => cropper!.setFramePosition(position),
      reset: () => cropper!.reset(),
      rotate: (deltaDeg) => cropper!.rotate(deltaDeg),
      flipHorizontal: () => cropper!.flipHorizontal(),
      flipVertical: () => cropper!.flipVertical(),
      setFrameSize: (width, height) => cropper!.setFrameSize(width, height),
      setFilters: (filters) => cropper!.setFilters(filters),
      getCropRegion: () => cropper!.getCropRegion(),
      export: (options) => cropper!.export(options),
      upload: (url, options) => cropper!.upload(url, options),
    };
    expose(exposed);

    return () => h("div", { ref: containerRef });
  },
});
