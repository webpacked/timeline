/**
 * SnapIndexManager — Phase 7 Step 2
 *
 * Debounces SnapIndex rebuilds using queueMicrotask.
 * Multiple scheduleRebuild() calls in one turn → single rebuild.
 */

import { toFrame } from '../types/frame';
import type { TimelineState } from '../types/state';
import type { SnapIndex } from '../snap-index';
import { buildSnapIndex } from '../snap-index';

export class SnapIndexManager {
  private index: SnapIndex | null = null;
  private state: TimelineState | null = null;
  private pending = false;

  getIndex(): SnapIndex | null {
    return this.index;
  }

  scheduleRebuild(state: TimelineState): void {
    this.state = state;
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      const s = this.state;
      if (s !== null) {
        this.index = buildSnapIndex(s, toFrame(0));
      }
    });
  }

  rebuildSync(state: TimelineState): void {
    this.index = buildSnapIndex(state, toFrame(0));
    this.state = state;
    this.pending = false;
  }

  get isPending(): boolean {
    return this.pending;
  }
}
