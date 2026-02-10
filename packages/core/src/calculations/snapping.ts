import type { TimeMs, ID } from '../types/common';
import type { Clip } from '../types/clip';
import type { Marker } from '../types/marker';
import type { Timeline } from '../types/timeline';
import { getClipEnd } from '../types/clip';

/**
 * Snapping System
 * 
 * Snapping makes editing feel precise by aligning clips to meaningful points.
 * This is PURE CALCULATION - no side effects, no mutations.
 * 
 * KEY CONCEPT: SNAPPING IS A QUERY
 * - Input: "I want to place something at time X"
 * - Output: "The nearest snap point is Y"
 * - The CALLER decides whether to use the snap point
 * 
 * WHY THIS DESIGN?
 * - Separation of concerns: calculation vs decision
 * - Testable: easy to verify snap points
 * - Flexible: caller can ignore snaps if needed (e.g., holding Shift)
 */

/**
 * SnapTarget - A point that can be snapped to
 */
export interface SnapTarget {
  /** Time position of the snap point */
  time: TimeMs;
  
  /** Type of snap target */
  type: 'clip-start' | 'clip-end' | 'playhead' | 'marker' | 'zero';
  
  /** Optional: ID of the entity (clip or marker) */
  entityId?: ID;
  
  /** Optional: Label for debugging */
  label?: string;
}

/**
 * SnapResult - Result of a snap calculation
 */
export interface SnapResult {
  /** Whether snapping occurred */
  snapped: boolean;
  
  /** Original time before snapping */
  originalTime: TimeMs;
  
  /** Time after snapping (same as original if not snapped) */
  snappedTime: TimeMs;
  
  /** The snap target that was used (if snapped) */
  target?: SnapTarget;
  
  /** Distance to the snap target in milliseconds */
  distance?: TimeMs;
}

/**
 * SnapOptions - Configuration for snapping behavior
 */
export interface SnapOptions {
  /** Snap threshold in milliseconds (default: 100ms) */
  threshold?: TimeMs;
  
  /** Enable snapping to clip starts */
  snapToClipStarts?: boolean;
  
  /** Enable snapping to clip ends */
  snapToClipEnds?: boolean;
  
  /** Enable snapping to playhead */
  snapToPlayhead?: boolean;
  
  /** Enable snapping to markers */
  snapToMarkers?: boolean;
  
  /** Enable snapping to zero (timeline start) */
  snapToZero?: boolean;
  
  /** Exclude specific clip IDs from snapping (useful when moving a clip) */
  excludeClipIds?: Set<ID>;
}

/**
 * Default snap options
 */
const DEFAULT_SNAP_OPTIONS: Required<SnapOptions> = {
  threshold: 100 as TimeMs,
  snapToClipStarts: true,
  snapToClipEnds: true,
  snapToPlayhead: true,
  snapToMarkers: true,
  snapToZero: true,
  excludeClipIds: new Set(),
};

/**
 * Collect all snap targets from a timeline
 * This builds a list of all possible snap points
 */
export const collectSnapTargets = (
  timeline: Timeline,
  playheadTime?: TimeMs,
  options: SnapOptions = {}
): SnapTarget[] => {
  const opts = { ...DEFAULT_SNAP_OPTIONS, ...options };
  const targets: SnapTarget[] = [];
  
  // Snap to zero (timeline start)
  if (opts.snapToZero) {
    targets.push({
      time: 0 as TimeMs,
      type: 'zero',
      label: 'Timeline start',
    });
  }
  
  // Snap to playhead
  if (opts.snapToPlayhead && playheadTime !== undefined) {
    targets.push({
      time: playheadTime,
      type: 'playhead',
      label: 'Playhead',
    });
  }
  
  // Snap to markers
  if (opts.snapToMarkers) {
    for (const marker of timeline.markers) {
      targets.push({
        time: marker.time,
        type: 'marker',
        entityId: marker.id,
        label: marker.label,
      });
    }
  }
  
  // Snap to clip edges
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      // Skip excluded clips
      if (opts.excludeClipIds?.has(clip.id)) {
        continue;
      }
      
      if (opts.snapToClipStarts) {
        targets.push({
          time: clip.start,
          type: 'clip-start',
          entityId: clip.id,
          label: `Clip ${clip.id} start`,
        });
      }
      
      if (opts.snapToClipEnds) {
        targets.push({
          time: getClipEnd(clip),
          type: 'clip-end',
          entityId: clip.id,
          label: `Clip ${clip.id} end`,
        });
      }
    }
  }
  
  return targets;
};

/**
 * Find the nearest snap target to a given time
 * Returns the closest target within the threshold
 */
export const findNearestSnapTarget = (
  time: TimeMs,
  targets: SnapTarget[],
  threshold: TimeMs = 100 as TimeMs
): SnapTarget | undefined => {
  let nearestTarget: SnapTarget | undefined;
  let nearestDistance = Infinity;
  
  for (const target of targets) {
    const distance = Math.abs(target.time - time);
    
    if (distance <= threshold && distance < nearestDistance) {
      nearestTarget = target;
      nearestDistance = distance;
    }
  }
  
  return nearestTarget;
};

/**
 * Snap a time value to the nearest snap target
 * This is the main snapping function
 * 
 * Example usage:
 * ```ts
 * const result = snapTime(timeline, 1050, playheadTime);
 * if (result.snapped) {
 *   console.log(`Snapped from ${result.originalTime} to ${result.snappedTime}`);
 *   console.log(`Target: ${result.target?.type}`);
 * }
 * ```
 */
export const snapTime = (
  timeline: Timeline,
  time: TimeMs,
  playheadTime?: TimeMs,
  options: SnapOptions = {}
): SnapResult => {
  const opts = { ...DEFAULT_SNAP_OPTIONS, ...options };
  
  // Collect all snap targets
  const targets = collectSnapTargets(timeline, playheadTime, opts);
  
  // Find nearest target
  const nearestTarget = findNearestSnapTarget(time, targets, opts.threshold);
  
  if (nearestTarget) {
    return {
      snapped: true,
      originalTime: time,
      snappedTime: nearestTarget.time,
      target: nearestTarget,
      distance: Math.abs(nearestTarget.time - time) as TimeMs,
    };
  }
  
  // No snap target found
  return {
    snapped: false,
    originalTime: time,
    snappedTime: time,
  };
};

/**
 * Snap a clip's start time
 * Useful when moving a clip
 */
export const snapClipStart = (
  timeline: Timeline,
  clip: Clip,
  newStart: TimeMs,
  playheadTime?: TimeMs,
  options: SnapOptions = {}
): SnapResult => {
  // Exclude the clip being moved from snap targets
  const opts = {
    ...options,
    excludeClipIds: new Set([...(options.excludeClipIds || []), clip.id]),
  };
  
  return snapTime(timeline, newStart, playheadTime, opts);
};

/**
 * Snap a clip's end time
 * Useful when resizing a clip from the right
 */
export const snapClipEnd = (
  timeline: Timeline,
  clip: Clip,
  newEnd: TimeMs,
  playheadTime?: TimeMs,
  options: SnapOptions = {}
): SnapResult => {
  // Exclude the clip being resized from snap targets
  const opts = {
    ...options,
    excludeClipIds: new Set([...(options.excludeClipIds || []), clip.id]),
  };
  
  return snapTime(timeline, newEnd, playheadTime, opts);
};
