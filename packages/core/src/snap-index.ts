/**
 * SNAP INDEX — Phase 1
 *
 * Pure functions. Zero React/DOM imports. Zero mutation.
 *
 * Phase 1 snap sources: ClipStart, ClipEnd, Playhead.
 * Phase 2 will add: Marker, InPoint, OutPoint.
 * Phase 3 will add: BeatGrid.
 *
 * Priority table (do not change values):
 *   Marker:    100
 *   InPoint:    90
 *   OutPoint:   90
 *   ClipStart:  80
 *   ClipEnd:    80
 *   Playhead:   70
 *   BeatGrid:   50
 */

import type { TimelineFrame } from './types/frame';
import type { TrackId }       from './types/track';
import type { TimelineState } from './types/state';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * All snap point sources across phases.
 * Defined in full now so SnapPoint & allowedTypes filters are stable.
 */
export type SnapPointType =
  | 'ClipStart'   // Phase 1
  | 'ClipEnd'     // Phase 1
  | 'Playhead'    // Phase 1
  | 'Marker'      // Phase 2
  | 'InPoint'     // Phase 2
  | 'OutPoint'    // Phase 2
  | 'BeatGrid';   // Phase 3

export type SnapPoint = {
  readonly frame:    TimelineFrame;
  readonly type:     SnapPointType;
  readonly priority: number;
  readonly trackId:  TrackId | null;  // null = timeline-wide (playhead, markers)
  readonly sourceId: string;          // clipId, markerId — used for exclusion list
};

export type SnapIndex = {
  readonly points:  readonly SnapPoint[];  // sorted ascending by frame
  readonly builtAt: number;               // Date.now()
  readonly enabled: boolean;
};

// ---------------------------------------------------------------------------
// Priority Table
// ---------------------------------------------------------------------------

const PRIORITIES: Record<SnapPointType, number> = {
  Marker:    100,
  InPoint:    90,
  OutPoint:   90,
  ClipStart:  80,
  ClipEnd:    80,
  Playhead:   70,
  BeatGrid:   50,
};

// ---------------------------------------------------------------------------
// buildSnapIndex
// ---------------------------------------------------------------------------

/**
 * Build a SnapIndex from committed state + playhead position.
 *
 * RULE: Call via queueMicrotask after accepted dispatch.
 *       Never call during a drag (pointer move).
 *
 * Phase 1 sources pulled (in order):
 *   1. ClipStart + ClipEnd from every clip on every track
 *   2. Playhead position (trackId = null)
 */
export function buildSnapIndex(
  state:         TimelineState,
  playheadFrame: TimelineFrame,
  enabled        = true,
): SnapIndex {
  const points: SnapPoint[] = [];

  // 1. Clip boundaries from all tracks
  for (const track of state.timeline.tracks) {
    for (const clip of track.clips) {
      points.push({
        frame:    clip.timelineStart,
        type:     'ClipStart',
        priority: PRIORITIES.ClipStart,
        trackId:  track.id,
        sourceId: clip.id,
      });
      points.push({
        frame:    clip.timelineEnd,
        type:     'ClipEnd',
        priority: PRIORITIES.ClipEnd,
        trackId:  track.id,
        sourceId: clip.id,
      });
    }
  }

  // 2. Playhead (timeline-wide)
  points.push({
    frame:    playheadFrame,
    type:     'Playhead',
    priority: PRIORITIES.Playhead,
    trackId:  null,
    sourceId: '__playhead__',
  });

  // 3. BeatGrid (Phase 3) — beat frames when beatGrid is set
  const beatGrid = state.timeline.beatGrid;
  const dur = state.timeline.duration;
  if (beatGrid !== null) {
    const fps = state.timeline.fps as number;
    const beatDurationFrames = Math.round((60 / beatGrid.bpm) * fps);
    let f: TimelineFrame = beatGrid.offset;
    while (f < dur) {
      points.push({
        frame:    f,
        type:     'BeatGrid',
        priority: PRIORITIES.BeatGrid,
        trackId:  null,
        sourceId: `__beat_${f}__`,
      });
      f = (f + beatDurationFrames) as TimelineFrame;
    }
  }

  // Sort ascending by frame
  points.sort((a, b) => a.frame - b.frame);

  return { points, builtAt: Date.now(), enabled };
}

// ---------------------------------------------------------------------------
// nearest
// ---------------------------------------------------------------------------

/**
 * Find the highest-priority snap candidate within radiusFrames.
 *
 * Returns null when:
 *   - index.enabled is false
 *   - no point is within radiusFrames of frame
 *
 * Tiebreak (equidistant candidates): highest priority wins.
 * Second tiebreak (equal priority): first in sorted order.
 *
 * @param exclude      sourceIds to skip (e.g. the clip being dragged)
 * @param allowedTypes if provided, only consider points of these types
 */
export function nearest(
  index:          SnapIndex,
  frame:          TimelineFrame,
  radiusFrames:   number,
  exclude?:       readonly string[],
  allowedTypes?:  readonly SnapPointType[],
): SnapPoint | null {
  if (!index.enabled) return null;

  const excludeSet = exclude ? new Set(exclude) : null;

  let best: SnapPoint | null = null;
  let bestDist = Infinity;

  for (const point of index.points) {
    // Apply exclusion list
    if (excludeSet && excludeSet.has(point.sourceId)) continue;

    // Apply type filter
    if (allowedTypes && !allowedTypes.includes(point.type)) continue;

    const dist = Math.abs(point.frame - frame);
    if (dist > radiusFrames) continue;

    // Prefer closer, then higher priority (higher wins)
    if (
      dist < bestDist ||
      (dist === bestDist && best !== null && point.priority > best.priority)
    ) {
      best = point;
      bestDist = dist;
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// toggleSnap
// ---------------------------------------------------------------------------

/**
 * Return a new SnapIndex with enabled toggled.
 * Does NOT rebuild points — pure field update.
 */
export function toggleSnap(index: SnapIndex, enabled: boolean): SnapIndex {
  return { ...index, enabled };
}
