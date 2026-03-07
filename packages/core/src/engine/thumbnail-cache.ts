/**
 * ThumbnailCache — Phase 7 Step 4
 *
 * In-memory LRU cache for thumbnail results.
 * No Worker — sits between pipeline and host's thumbnail provider.
 */

import type { ThumbnailRequest, ThumbnailResult } from '../types/pipeline';
import type { ClipId } from '../types/clip';

export class ThumbnailCache {
  private cache: Map<string, ThumbnailResult> = new Map();
  private order: string[] = [];
  private maxSize: number;

  constructor(maxSize: number = 200) {
    this.maxSize = maxSize;
  }

  private key(request: ThumbnailRequest): string {
    return `${request.clipId}:${request.mediaFrame}:${request.width}x${request.height}`;
  }

  get(request: ThumbnailRequest): ThumbnailResult | null {
    const k = this.key(request);
    if (!this.cache.has(k)) return null;
    const idx = this.order.indexOf(k);
    if (idx >= 0) {
      this.order.splice(idx, 1);
      this.order.push(k);
    }
    return this.cache.get(k) ?? null;
  }

  set(request: ThumbnailRequest, result: ThumbnailResult): void {
    const k = this.key(request);
    if (this.cache.has(k)) {
      this.cache.set(k, result);
      const idx = this.order.indexOf(k);
      if (idx >= 0) {
        this.order.splice(idx, 1);
        this.order.push(k);
      }
      return;
    }
    this.cache.set(k, result);
    this.order.push(k);
    if (this.cache.size > this.maxSize && this.order.length > 0) {
      const oldest = this.order.shift()!;
      this.cache.delete(oldest);
    }
  }

  has(request: ThumbnailRequest): boolean {
    return this.cache.has(this.key(request));
  }

  invalidateClip(clipId: ClipId): void {
    const prefix = `${clipId}:`;
    for (const k of this.order) {
      if (k.startsWith(prefix)) this.cache.delete(k);
    }
    this.order = this.order.filter((k) => !k.startsWith(prefix));
  }

  clear(): void {
    this.cache.clear();
    this.order = [];
  }

  get size(): number {
    return this.cache.size;
  }
}
