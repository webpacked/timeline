/**
 * StateChange diff — Phase 7 Step 2
 *
 * Lightweight diff for hook optimization: compare prev vs next
 * by reference so hooks can skip re-render when nothing relevant changed.
 */

import type { TimelineState } from './state';
import type { ClipId } from './clip';

export type StateChange = {
  readonly trackIds: boolean;
  readonly clipIds: ReadonlySet<ClipId>;
  readonly markers: boolean;
  readonly timeline: boolean;
  readonly playhead: boolean;
};

export const EMPTY_STATE_CHANGE: StateChange = {
  trackIds: false,
  clipIds: new Set<ClipId>(),
  markers: false,
  timeline: false,
  playhead: false,
};

/**
 * Diffs prev and next state by reference.
 * clipIds: set of clip ids whose clip reference changed or were added/removed.
 */
export function diffStates(
  prev: TimelineState,
  next: TimelineState,
): StateChange {
  const clipIds = new Set<ClipId>();

  // trackIds: track array reference changed
  const trackIds = prev.timeline.tracks !== next.timeline.tracks;

  // markers
  const markers = prev.timeline.markers !== next.timeline.markers;

  // timeline (fps, duration, etc.)
  const timeline = prev.timeline !== next.timeline;

  // clipIds: collect where clip reference changed or clip added/removed
  const prevTracks = prev.timeline.tracks;
  const nextTracks = next.timeline.tracks;
  for (let i = 0; i < nextTracks.length; i++) {
    const nextTrack = nextTracks[i]!;
    const prevTrack = prevTracks.find((t) => t.id === nextTrack.id);
    for (const nextClip of nextTrack.clips) {
      const prevClip = prevTrack?.clips.find((c) => c.id === nextClip.id);
      if (prevClip !== nextClip) {
        clipIds.add(nextClip.id);
      }
    }
  }
  // Removed clips: in prev but not in next
  for (let i = 0; i < prevTracks.length; i++) {
    const prevTrack = prevTracks[i]!;
    const nextTrack = nextTracks.find((t) => t.id === prevTrack.id);
    for (const prevClip of prevTrack.clips) {
      const stillPresent = nextTrack?.clips.some((c) => c.id === prevClip.id);
      if (!stillPresent) {
        clipIds.add(prevClip.id);
      }
    }
  }

  return {
    trackIds,
    clipIds,
    markers,
    timeline,
    playhead: false,
  };
}
