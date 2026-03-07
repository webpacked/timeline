/**
 * ThumbnailQueue — Phase 7 Step 4
 *
 * Priority queue for thumbnail requests.
 * Visible clips get 'high', off-screen get 'low'.
 */

import type { ThumbnailRequest } from '../types/pipeline';
import type { TimelineFrame } from '../types/frame';
import type { ClipId } from '../types/clip';
import type { ThumbnailPriority, ThumbnailQueueEntry } from '../types/worker-contracts';

function priorityValue(p: ThumbnailPriority): number {
  switch (p) {
    case 'high':
      return 2;
    case 'normal':
      return 1;
    case 'low':
      return 0;
    default:
      return 1;
  }
}

function sameRequest(a: ThumbnailRequest, b: ThumbnailRequest): boolean {
  return a.clipId === b.clipId && (a.mediaFrame as number) === (b.mediaFrame as number);
}

export class ThumbnailQueue {
  private entries: ThumbnailQueueEntry[] = [];

  enqueue(
    request: ThumbnailRequest,
    priority: ThumbnailPriority = 'normal',
  ): void {
    const existing = this.entries.find((e) => sameRequest(e.request, request));
    if (existing) {
      if (priorityValue(priority) > priorityValue(existing.priority)) {
        this.entries = this.entries.map((e) =>
          sameRequest(e.request, request) ? { ...e, priority } : e,
        );
      }
      return;
    }
    this.entries.push({
      request,
      priority,
      addedAt: Date.now(),
    });
  }

  dequeue(): ThumbnailQueueEntry | null {
    if (this.entries.length === 0) return null;
    this.entries.sort((a, b) => {
      const p = priorityValue(b.priority) - priorityValue(a.priority);
      if (p !== 0) return p;
      return a.addedAt - b.addedAt;
    });
    return this.entries.shift() ?? null;
  }

  cancel(clipId: ClipId): void {
    this.entries = this.entries.filter((e) => e.request.clipId !== clipId);
  }

  setPriority(
    clipId: ClipId,
    mediaFrame: TimelineFrame,
    priority: ThumbnailPriority,
  ): void {
    const m = mediaFrame as number;
    this.entries = this.entries.map((e) => {
      if (e.request.clipId === clipId && (e.request.mediaFrame as number) === m) {
        return { ...e, priority };
      }
      return e;
    });
  }

  get length(): number {
    return this.entries.length;
  }

  peek(): ThumbnailQueueEntry | null {
    if (this.entries.length === 0) return null;
    const sorted = [...this.entries].sort((a, b) => {
      const p = priorityValue(b.priority) - priorityValue(a.priority);
      if (p !== 0) return p;
      return a.addedAt - b.addedAt;
    });
    return sorted[0] ?? null;
  }

  clear(): void {
    this.entries = [];
  }
}
