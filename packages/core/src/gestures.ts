import type { KiriState, Offset } from "./types";

export interface Size {
  width: number;
  height: number;
}

/** Rotation-aware natural size: 90/270 degrees swap width and height. */
export function effectiveNaturalSize(natural: Size, rotationDeg: number): Size {
  const swapped = ((rotationDeg / 90) % 2 + 2) % 2 === 1;
  return swapped
    ? { width: natural.height, height: natural.width }
    : { width: natural.width, height: natural.height };
}

/** The smallest scale at which the (rotation-adjusted) image still fully covers the frame. */
export function computeCoverScale(
  natural: Size,
  frame: Size,
  rotationDeg: number
): number {
  const eff = effectiveNaturalSize(natural, rotationDeg);
  if (eff.width <= 0 || eff.height <= 0) return 1;
  return Math.max(frame.width / eff.width, frame.height / eff.height);
}

/** Rendered size of the image layer given a user zoom multiplier (relative to cover scale). */
export function effectiveRenderedSize(
  natural: Size,
  frame: Size,
  rotationDeg: number,
  zoom: number
): Size {
  const eff = effectiveNaturalSize(natural, rotationDeg);
  const scale = computeCoverScale(natural, frame, rotationDeg) * zoom;
  return { width: eff.width * scale, height: eff.height * scale };
}

export function clampZoom(zoom: number, minZoom: number, maxZoom: number): number {
  return Math.min(Math.max(zoom, minZoom), maxZoom);
}

/**
 * Clamp the image-center offset (from stage/frame center) so the frame stays
 * fully covered by the rendered image on every axis.
 */
export function clampOffset(offset: Offset, rendered: Size, frame: Size): Offset {
  const maxX = Math.max(0, (rendered.width - frame.width) / 2);
  const maxY = Math.max(0, (rendered.height - frame.height) / 2);
  // `|| 0` normalizes -0 (e.g. clamping a negative offset to a zero-width
  // range) to +0, keeping state comparisons and serialized CSS values sane.
  return {
    x: Math.min(Math.max(offset.x, -maxX), maxX) || 0,
    y: Math.min(Math.max(offset.y, -maxY), maxY) || 0,
  };
}

export function normalizeRotation(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

interface GestureCallbacks {
  getNaturalSize: () => Size;
  getFrameSize: () => Size;
  getState: () => KiriState;
  getMinMaxZoom: () => { min: number; max: number };
  setState: (next: KiriState) => void;
}

export interface GestureOptions {
  mouseWheelZoom?: boolean | "ctrl";
}

function pointerDistance(a: PointerEvent, b: PointerEvent): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function attachGestures(
  stageEl: HTMLElement,
  callbacks: GestureCallbacks,
  options: GestureOptions
): { destroy: () => void } {
  const activePointers = new Map<number, PointerEvent>();
  let dragStart: { x: number; y: number; offset: Offset } | null = null;
  let pinchStartDistance = 0;
  let pinchStartZoom = 1;

  function applyClampedState(next: KiriState): void {
    const { min, max } = callbacks.getMinMaxZoom();
    const zoom = clampZoom(next.zoom, min, max);
    const rendered = effectiveRenderedSize(
      callbacks.getNaturalSize(),
      callbacks.getFrameSize(),
      next.rotation,
      zoom
    );
    const offset = clampOffset(next.offset, rendered, callbacks.getFrameSize());
    callbacks.setState({
      zoom,
      offset,
      rotation: normalizeRotation(next.rotation),
      flip: next.flip,
      filters: next.filters,
    });
  }

  function onPointerDown(e: PointerEvent): void {
    stageEl.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, e);
    if (activePointers.size === 1) {
      const state = callbacks.getState();
      dragStart = { x: e.clientX, y: e.clientY, offset: state.offset };
      stageEl.classList.add("kiri-dragging");
    } else if (activePointers.size === 2) {
      dragStart = null;
      const [a, b] = [...activePointers.values()];
      pinchStartDistance = pointerDistance(a, b);
      pinchStartZoom = callbacks.getState().zoom;
    }
  }

  function onPointerMove(e: PointerEvent): void {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, e);

    if (activePointers.size === 2) {
      const [a, b] = [...activePointers.values()];
      const distance = pointerDistance(a, b);
      if (pinchStartDistance > 0) {
        const ratio = distance / pinchStartDistance;
        const state = callbacks.getState();
        applyClampedState({ ...state, zoom: pinchStartZoom * ratio });
      }
      return;
    }

    if (dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const state = callbacks.getState();
      applyClampedState({
        ...state,
        offset: { x: dragStart.offset.x + dx, y: dragStart.offset.y + dy },
      });
    }
  }

  function onPointerUp(e: PointerEvent): void {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinchStartDistance = 0;
    if (activePointers.size === 0) {
      dragStart = null;
      stageEl.classList.remove("kiri-dragging");
    }
  }

  function onWheel(e: WheelEvent): void {
    if (!options.mouseWheelZoom) return;
    if (options.mouseWheelZoom === "ctrl" && !e.ctrlKey) return;
    e.preventDefault();
    const state = callbacks.getState();
    const delta = -e.deltaY * 0.0015;
    applyClampedState({ ...state, zoom: state.zoom * (1 + delta) });
  }

  stageEl.addEventListener("pointerdown", onPointerDown);
  stageEl.addEventListener("pointermove", onPointerMove);
  stageEl.addEventListener("pointerup", onPointerUp);
  stageEl.addEventListener("pointercancel", onPointerUp);
  stageEl.addEventListener("wheel", onWheel, { passive: false });

  return {
    destroy(): void {
      stageEl.removeEventListener("pointerdown", onPointerDown);
      stageEl.removeEventListener("pointermove", onPointerMove);
      stageEl.removeEventListener("pointerup", onPointerUp);
      stageEl.removeEventListener("pointercancel", onPointerUp);
      stageEl.removeEventListener("wheel", onWheel);
    },
  };
}
