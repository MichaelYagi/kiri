import { Kiri } from "./kiri";
import type { ExportOptions, ExportResult, KiriOptions, LoadOptions } from "./types";

export interface KiriBatchItem {
  source: File | Blob | string;
  loadOptions?: LoadOptions;
}

/**
 * Steps a single shared `Kiri` instance through a queue of images, so the
 * whole drag/zoom/rotate/flip/filters interaction surface is reused as-is —
 * no per-image instance, no duplicated cropping logic.
 */
export class KiriBatch {
  readonly cropper: Kiri;
  private readonly items: KiriBatchItem[];
  private index = -1;
  private captures: ExportResult[] = [];

  constructor(container: HTMLElement, options: KiriOptions = {}, items: KiriBatchItem[] = []) {
    this.cropper = new Kiri(container, options);
    this.items = [...items];
  }

  add(item: KiriBatchItem): void {
    this.items.push(item);
  }

  get length(): number {
    return this.items.length;
  }

  /** Loads the next queued image into `cropper`. Returns false once the queue is exhausted. */
  async next(): Promise<boolean> {
    if (this.index + 1 >= this.items.length) return false;
    this.index += 1;
    const item = this.items[this.index];
    await this.cropper.load(item.source, item.loadOptions);
    return true;
  }

  /** Metadata for the currently loaded item, or null before the first next() / after exhaustion. */
  current(): KiriBatchItem | null {
    return this.items[this.index] ?? null;
  }

  /** Exports the current crop and stores it, indexed by item order. */
  async capture(options?: ExportOptions): Promise<ExportResult> {
    const result = await this.cropper.export(options);
    this.captures[this.index] = result;
    return result;
  }

  /** All captures made so far, in item order (sparse where an item hasn't been captured yet). */
  results(): ExportResult[] {
    return [...this.captures];
  }

  destroy(): void {
    this.cropper.destroy();
  }
}
