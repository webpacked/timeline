/**
 * DRAG STATE MODEL
 * 
 * Ephemeral drag preview calculations.
 * Never stored in timeline state - lives in UI layer only.
 * 
 * DESIGN:
 * - Drag state is isolated from timeline state
 * - Integrates snapping automatically
 * - Pre-validates before commit
 * - Pure calculations - no mutations
 */

import { TimelineState } from '../types/state';
import { Frame } from '../types/frame';
import { Clip } from '../types/clip';
import { SnapTarget, SnapResult, calculateSnapExcluding, findSnapTargets } from '../systems/snapping';
import { findClipById } from '../systems/queries';
import { validateClip, validateTrack } from '../systems/validation';

/**
 * Drag state - ephemeral preview
 */
export interface DragState {
  /** Clip being dragged */
  clipId: string;
  
  /** Original position before drag */
  originalStart: Frame;
  originalEnd: Frame;
  
  /** Proposed position during drag */
  proposedStart: Frame;
  proposedEnd: Frame;
  
  /** Whether snapping occurred */
  snapped: boolean;
  
  /** Snap target if snapped */
  snapTarget?: SnapTarget;
  
  /** Whether the proposed position is valid */
  valid: boolean;
  
  /** Validation errors if invalid */
  validationErrors?: string[];
}

/**
 * Calculate drag preview
 * 
 * Pure function - does not mutate state.
 * 
 * @param state - Timeline state
 * @param clipId - Clip being dragged
 * @param proposedStart - Proposed start frame
 * @param snapThreshold - Snap threshold in frames
 * @param playhead - Optional playhead position for snapping
 * @returns Drag state preview
 */
export function calculateDragPreview(
  state: TimelineState,
  clipId: string,
  proposedStart: Frame,
  snapThreshold: Frame,
  playhead?: Frame
): DragState {
  const clip = findClipById(state, clipId);
  if (!clip) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  
  const clipDuration = clip.timelineEnd - clip.timelineStart;
  
  // Find snap targets (excluding the clip being dragged)
  const snapTargets = findSnapTargets(state, playhead);
  
  // Calculate snap for proposed start
  const snapResult = calculateSnapExcluding(
    proposedStart,
    snapTargets,
    snapThreshold,
    [clipId]
  );
  
  // Use snapped position if snapping occurred
  const finalStart = snapResult.snapped ? snapResult.snappedFrame : proposedStart;
  const finalEnd = (finalStart + clipDuration) as Frame;
  
  // Create preview clip for validation
  const previewClip: Clip = {
    ...clip,
    timelineStart: finalStart,
    timelineEnd: finalEnd,
  };
  
  // Validate the proposed position
  const validationErrors: string[] = [];
  
  // Check clip bounds
  const clipResult = validateClip(state, previewClip);
  if (!clipResult.valid) {
    validationErrors.push(...clipResult.errors.map((e: any) => e.message));
  }
  
  // Check track collisions (create temporary state for validation)
  const tempState: TimelineState = {
    ...state,
    timeline: {
      ...state.timeline,
      tracks: state.timeline.tracks.map(track => {
        if (track.id === clip.trackId) {
          return {
            ...track,
            clips: track.clips.map(c => c.id === clipId ? previewClip : c),
          };
        }
        return track;
      }),
    },
  };
  
  // Find the track for validation
  const track = tempState.timeline.tracks.find(t => t.id === clip.trackId);
  if (track) {
    const trackResult = validateTrack(tempState, track);
    if (!trackResult.valid) {
      validationErrors.push(...trackResult.errors.map((e: any) => e.message));
    }
  }
  
  const result: DragState = {
    clipId,
    originalStart: clip.timelineStart,
    originalEnd: clip.timelineEnd,
    proposedStart: finalStart,
    proposedEnd: finalEnd,
    snapped: snapResult.snapped,
    valid: validationErrors.length === 0,
  };
  
  // Only add optional properties if defined
  if (snapResult.target !== undefined) {
    result.snapTarget = snapResult.target;
  }
  if (validationErrors.length > 0) {
    result.validationErrors = validationErrors;
  }
  
  return result;
}

/**
 * Calculate drag preview for resize
 * 
 * @param state - Timeline state
 * @param clipId - Clip being resized
 * @param proposedEnd - Proposed end frame
 * @param snapThreshold - Snap threshold in frames
 * @param playhead - Optional playhead position
 * @returns Drag state preview
 */
export function calculateResizeDragPreview(
  state: TimelineState,
  clipId: string,
  proposedEnd: Frame,
  snapThreshold: Frame,
  playhead?: Frame
): DragState {
  const clip = findClipById(state, clipId);
  if (!clip) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  
  // Find snap targets
  const snapTargets = findSnapTargets(state, playhead);
  
  // Calculate snap for proposed end
  const snapResult = calculateSnapExcluding(
    proposedEnd,
    snapTargets,
    snapThreshold,
    [clipId]
  );
  
  const finalEnd = snapResult.snapped ? snapResult.snappedFrame : proposedEnd;
  
  // Create preview clip
  const previewClip: Clip = {
    ...clip,
    timelineEnd: finalEnd,
  };
  
  // Validate
  const validationErrors: string[] = [];
  
  const clipResult = validateClip(state, previewClip);
  if (!clipResult.valid) {
    validationErrors.push(...clipResult.errors.map((e: any) => e.message));
  }
  
  const result: DragState = {
    clipId,
    originalStart: clip.timelineStart,
    originalEnd: clip.timelineEnd,
    proposedStart: clip.timelineStart,
    proposedEnd: finalEnd,
    snapped: snapResult.snapped,
    valid: validationErrors.length === 0,
  };
  
  // Only add optional properties if defined
  if (snapResult.target !== undefined) {
    result.snapTarget = snapResult.target;
  }
  if (validationErrors.length > 0) {
    result.validationErrors = validationErrors;
  }
  
  return result;
}
