/**
 * SNAPPING SYSTEM
 * 
 * Pure snapping calculations for professional editing feel.
 * 
 * DESIGN PRINCIPLES:
 * - Snapping is READ-ONLY (never mutates state)
 * - Returns proposed snapped frame
 * - Caller decides whether to use snapped value
 * - Threshold in frames (not pixels)
 * - Viewport conversion happens outside this system
 * 
 * SNAP TARGETS:
 * - Clip start/end positions
 * - Timeline markers
 * - Playhead position
 * - Work area boundaries
 * 
 * USAGE:
 * ```typescript
 * const targets = findSnapTargets(state, playhead);
 * const result = calculateSnap(proposedFrame, targets, frame(5));
 * const finalFrame = result.snapped ? result.snappedFrame : result.originalFrame;
 * ```
 */

import { TimelineState } from '../types/state';
import { Frame } from '../types/frame';
import { getAllClips } from './queries';

/**
 * Snap target types
 */
export type SnapTarget = 
  | { type: 'clip-start'; clipId: string; frame: Frame }
  | { type: 'clip-end'; clipId: string; frame: Frame }
  | { type: 'timeline-marker'; markerId: string; frame: Frame }
  | { type: 'playhead'; frame: Frame }
  | { type: 'work-area-start'; frame: Frame }
  | { type: 'work-area-end'; frame: Frame };

/**
 * Snap result
 */
export interface SnapResult {
  /** Whether snapping occurred */
  snapped: boolean;
  
  /** Original frame before snapping */
  originalFrame: Frame;
  
  /** Snapped frame (same as original if not snapped) */
  snappedFrame: Frame;
  
  /** Target that was snapped to (if snapped) */
  target?: SnapTarget;
  
  /** Distance to snap target in frames */
  distance: number;
}

/**
 * Find all snap targets in the timeline
 * 
 * @param state - Timeline state
 * @param playhead - Optional playhead position to include as target
 * @returns Array of snap targets
 */
export function findSnapTargets(
  state: TimelineState,
  playhead?: Frame
): SnapTarget[] {
  const targets: SnapTarget[] = [];
  
  // Add clip start/end positions
  const clips = getAllClips(state);
  for (const clip of clips) {
    targets.push({
      type: 'clip-start',
      clipId: clip.id,
      frame: clip.timelineStart,
    });
    
    targets.push({
      type: 'clip-end',
      clipId: clip.id,
      frame: clip.timelineEnd,
    });
  }
  
  // Add timeline markers
  for (const marker of state.markers.timeline) {
    targets.push({
      type: 'timeline-marker',
      markerId: marker.id,
      frame: marker.frame,
    });
  }
  
  // Add playhead if provided
  if (playhead !== undefined) {
    targets.push({
      type: 'playhead',
      frame: playhead,
    });
  }
  
  // Add work area boundaries if defined
  if (state.workArea) {
    targets.push({
      type: 'work-area-start',
      frame: state.workArea.startFrame,
    });
    
    targets.push({
      type: 'work-area-end',
      frame: state.workArea.endFrame,
    });
  }
  
  return targets;
}

/**
 * Calculate snap for a given frame
 * 
 * Pure function - does not mutate state.
 * 
 * @param frame - Frame to snap
 * @param targets - Available snap targets
 * @param threshold - Snap threshold in frames
 * @returns Snap result
 */
export function calculateSnap(
  frame: Frame,
  targets: SnapTarget[],
  threshold: Frame
): SnapResult {
  let closestTarget: SnapTarget | undefined;
  let closestDistance = Infinity;
  
  // Find closest target within threshold
  for (const target of targets) {
    const distance = Math.abs(target.frame - frame);
    
    if (distance <= threshold && distance < closestDistance) {
      closestTarget = target;
      closestDistance = distance;
    }
  }
  
  // Return snap result
  if (closestTarget) {
    return {
      snapped: true,
      originalFrame: frame,
      snappedFrame: closestTarget.frame,
      target: closestTarget,
      distance: closestDistance,
    };
  }
  
  // No snap
  return {
    snapped: false,
    originalFrame: frame,
    snappedFrame: frame,
    distance: 0,
  };
}

/**
 * Calculate snap excluding specific clips
 * 
 * Useful when dragging a clip - don't snap to itself.
 * 
 * @param frame - Frame to snap
 * @param targets - Available snap targets
 * @param threshold - Snap threshold in frames
 * @param excludeClipIds - Clip IDs to exclude from snapping
 * @returns Snap result
 */
export function calculateSnapExcluding(
  frame: Frame,
  targets: SnapTarget[],
  threshold: Frame,
  excludeClipIds: string[]
): SnapResult {
  // Filter out excluded clips
  const filteredTargets = targets.filter(target => {
    if (target.type === 'clip-start' || target.type === 'clip-end') {
      return !excludeClipIds.includes(target.clipId);
    }
    return true;
  });
  
  return calculateSnap(frame, filteredTargets, threshold);
}

/**
 * Find snap targets for a specific track
 * 
 * Useful for track-specific snapping.
 * 
 * @param state - Timeline state
 * @param trackId - Track ID to find targets for
 * @param playhead - Optional playhead position
 * @returns Array of snap targets
 */
export function findSnapTargetsForTrack(
  state: TimelineState,
  trackId: string,
  playhead?: Frame
): SnapTarget[] {
  const targets: SnapTarget[] = [];
  
  // Find track
  const track = state.timeline.tracks.find(t => t.id === trackId);
  if (!track) return targets;
  
  // Add clip start/end positions from this track only
  for (const clip of track.clips) {
    targets.push({
      type: 'clip-start',
      clipId: clip.id,
      frame: clip.timelineStart,
    });
    
    targets.push({
      type: 'clip-end',
      clipId: clip.id,
      frame: clip.timelineEnd,
    });
  }
  
  // Add timeline markers (always relevant)
  for (const marker of state.markers.timeline) {
    targets.push({
      type: 'timeline-marker',
      markerId: marker.id,
      frame: marker.frame,
    });
  }
  
  // Add playhead if provided
  if (playhead !== undefined) {
    targets.push({
      type: 'playhead',
      frame: playhead,
    });
  }
  
  // Add work area boundaries if defined
  if (state.workArea) {
    targets.push({
      type: 'work-area-start',
      frame: state.workArea.startFrame,
    });
    
    targets.push({
      type: 'work-area-end',
      frame: state.workArea.endFrame,
    });
  }
  
  return targets;
}
