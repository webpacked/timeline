/**
 * TrackIndex — Phase 7 Step 1
 *
 * Wraps IntervalTree per track for O(log n + k) getClipsAtFrame.
 */

import type { Clip } from '../types/clip';
import type { Track } from '../types/track';
import type { TimelineState } from '../types/state';
import { IntervalTree } from './interval-tree';

export type ClipEntry = {
  clip: Clip;
  track: Track;
  trackIndex: number;
};

export class TrackIndex {
  private tree: IntervalTree<ClipEntry> = new IntervalTree();
  private built = false;

  build(state: TimelineState): void {
    const intervals: Array<{ start: number; end: number; data: ClipEntry }> = [];
    const tracks = state.timeline.tracks;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i]!;
      for (const clip of track.clips) {
        const start = clip.timelineStart as number;
        const end = clip.timelineEnd as number;
        intervals.push({
          start,
          end,
          data: { clip, track, trackIndex: i },
        });
      }
    }
    this.tree.build(intervals);
    this.built = true;
  }

  query(frame: number): ClipEntry[] {
    if (!this.built) {
      throw new Error('TrackIndex not built');
    }
    return this.tree.query(frame).sort((a, b) => a.trackIndex - b.trackIndex);
  }

  get isBuilt(): boolean {
    return this.built;
  }

  invalidate(): void {
    this.built = false;
  }
}
