/**
 * Virtual rendering contract — Phase 7 Step 2
 *
 * Defines what is "visible" so the React layer can mount
 * only visible clip components.
 */

import { toFrame } from '../types/frame';
import type { TimelineFrame } from '../types/frame';
import type { TimelineState } from '../types/state';
import type { Clip } from '../types/clip';
import type { Track } from '../types/track';

export type VirtualWindow = {
  readonly startFrame: TimelineFrame;
  readonly endFrame: TimelineFrame;
  readonly pixelsPerFrame: number;
};

export type VirtualClipEntry = {
  readonly clip: Clip;
  readonly track: Track;
  readonly trackIndex: number;
  readonly isVisible: boolean;
  readonly left: number;
  readonly width: number;
};

/**
 * Returns all clips with visibility and layout (left, width).
 * Sorted by trackIndex ascending, then by clip timelineStart ascending.
 */
export function getVisibleClips(
  state: TimelineState,
  window: VirtualWindow,
): VirtualClipEntry[] {
  const startN = window.startFrame as number;
  const endN = window.endFrame as number;
  const ppf = window.pixelsPerFrame;
  const result: VirtualClipEntry[] = [];
  const tracks = state.timeline.tracks;
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i]!;
    const sortedClips = [...track.clips].sort(
      (a, b) => (a.timelineStart as number) - (b.timelineStart as number),
    );
    for (const clip of sortedClips) {
      const clipStart = clip.timelineStart as number;
      const clipEnd = clip.timelineEnd as number;
      const durationFrames = clipEnd - clipStart;
      const isVisible = clipEnd > startN && clipStart < endN;
      const left = (clipStart - startN) * ppf;
      const width = durationFrames * ppf;
      result.push({
        clip,
        track,
        trackIndex: i,
        isVisible,
        left,
        width,
      });
    }
  }
  return result;
}

/**
 * Builds a VirtualWindow from viewport dimensions and scroll.
 */
export function getVisibleFrameRange(
  viewportWidth: number,
  scrollLeft: number,
  pixelsPerFrame: number,
): VirtualWindow {
  const startFrame = toFrame(Math.floor(scrollLeft / pixelsPerFrame));
  const endFrame = toFrame(
    Math.ceil((scrollLeft + viewportWidth) / pixelsPerFrame),
  );
  return {
    startFrame,
    endFrame,
    pixelsPerFrame,
  };
}
