export type FrameShape = "rect" | "circle";

export interface FrameSize {
  width: number;
  height: number;
}

export interface Offset {
  x: number;
  y: number;
}

export interface KiriOptions {
  frame?: {
    shape?: FrameShape;
    width?: number;
    height?: number;
  };
  minZoom?: number;
  maxZoom?: number;
  rotatable?: boolean;
  resizableFrame?: boolean;
  mouseWheelZoom?: boolean | "ctrl";
  useExifOrientation?: boolean;
}

export interface KiriState {
  zoom: number;
  offset: Offset;
  rotation: number;
}

export interface LoadOptions {
  zoom?: number;
  offset?: Offset;
  rotation?: number;
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

export type ExportResult = string | Blob | HTMLCanvasElement;

export type KiriEventName = "change";
export type KiriEventCallback = (state: KiriState) => void;
