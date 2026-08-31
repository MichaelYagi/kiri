export type FrameShape = "rectangle" | "circle";
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

export interface Filters {
  brightness: number;
  contrast: number;
  saturation: number;
  grayscale: boolean;
  sepia: boolean;
}

export type Uploader = (
  blob: Blob,
  options: UploadOptions & { url: string }
) => Promise<unknown>;

export interface KiriOptions {
  frame?: {
    shape?: FrameShape;
    width?: number;
    height?: number;
  };
  minZoom?: number;
  maxZoom?: number;
  rotatable?: boolean;
  flippable?: boolean;
  resizableFrame?: boolean;
  mouseWheelZoom?: boolean | "ctrl";
  useExifOrientation?: boolean;
  filters?: Partial<Filters>;
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

export interface KiriState {
  zoom: number;
  offset: Offset;
  rotation: number;
  flip: Flip;
  filters: Filters;
}

export interface LoadOptions {
  zoom?: number;
  offset?: Offset;
  rotation?: number;
  flip?: Partial<Flip>;
}

export type ExportType = "base64" | "blob" | "canvas";
export type ExportFormat = "image/jpeg" | "image/png" | "image/webp";

export interface ExportOptions {
  type?: ExportType;
  format?: ExportFormat;
  quality?: number;
  width?: number;
  height?: number;
}

export interface UploadOptions extends ExportOptions {
  fieldName?: string;
  fileName?: string;
  extraFields?: Record<string, string>;
  fetchOptions?: RequestInit;
  uploader?: Uploader;
}

export type ExportResult = string | Blob | HTMLCanvasElement;

export type KiriEventName = "change";
export type KiriEventCallback = (state: KiriState) => void;
