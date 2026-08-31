import { defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from "vue";
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

export interface KiriCropperExposed {
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
 * underlying `Kiri` instance, and exposes its methods on the component
 * instance (via a template ref). Props are captured once on mount — to
 * change them later, use the exposed methods rather than re-rendering with
 * new props.
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

    onMounted(() => {
      if (!containerRef.value) return;
      cropper = new Kiri(containerRef.value, {
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
      cropper.on("change", (state) => emit("change", state));
    });

    onBeforeUnmount(() => {
      cropper?.destroy();
      cropper = null;
    });

    const exposed: KiriCropperExposed = {
      load: (source, options) => cropper!.load(source, options),
      getState: () => cropper!.getState(),
      setZoom: (zoom) => cropper!.setZoom(zoom),
      rotate: (deltaDeg) => cropper!.rotate(deltaDeg),
      flipHorizontal: () => cropper!.flipHorizontal(),
      flipVertical: () => cropper!.flipVertical(),
      setFrameSize: (width, height) => cropper!.setFrameSize(width, height),
      setFilters: (filters) => cropper!.setFilters(filters),
      export: (options) => cropper!.export(options),
      upload: (url, options) => cropper!.upload(url, options),
    };
    expose(exposed);

    return () => h("div", { ref: containerRef });
  },
});
