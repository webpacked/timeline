/**
 * RIPPLE OPERATIONS
 * 
 * Ripple edits shift subsequent clips on the same track.
 * These compose basic operations using transactions.
 * 
 * DESIGN:
 * - Use transactions to batch multiple moves
 * - Only affect clips on the same track
 * - Preserve Phase 1 collision rules
 * - Pure functions - no mutations
 */

import { TimelineState } from '../types/state';
import type { TimelineFrame } from '../types/frame';
type Frame = TimelineFrame;
import { Clip, getClipDuration } from '../types/clip';
import { findClipById, findTrackById } from '../systems/queries';
import { removeClip, moveClip, resizeClip, addClip } from './clip-operations';
import { beginTransaction, applyOperation, commitTransaction } from '../engine/transactions';

/**
 * Ripple delete - delete clip and shift all subsequent clips left
 * 
 * @param state - Timeline state
 * @param clipId - Clip ID to delete
 * @returns New state with clip deleted and subsequent clips shifted
 */
export function rippleDelete(
  state: TimelineState,
  clipId: string
): TimelineState {
  const clip = findClipById(state, clipId);
  if (!clip) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  
  const track = findTrackById(state, clip.trackId);
  if (!track) {
    throw new Error(`Track not found: ${clip.trackId}`);
  }
  
  // Calculate gap created by deletion
  const clipDuration = getClipDuration(clip);
  const deleteEnd = clip.timelineEnd;
  
  // Find all clips after this one on the same track
  const clipsToShift = track.clips.filter(c => 
    c.id !== clipId && c.timelineStart >= deleteEnd
  );
  
  // Use transaction to delete and shift
  let tx = beginTransaction(state);
  
  // Delete the clip first
  tx = applyOperation(tx, s => removeClip(s, clipId));
  
  // Shift all subsequent clips left by the clip duration
  for (const clipToShift of clipsToShift) {
    const newStart = (clipToShift.timelineStart - clipDuration) as Frame;
    tx = applyOperation(tx, s => moveClip(s, clipToShift.id, newStart));
  }
  
  return commitTransaction(tx);
}

/**
 * Ripple trim - trim clip end and shift all subsequent clips
 * 
 * @param state - Timeline state
 * @param clipId - Clip ID to trim
 * @param newEnd - New end frame for the clip
 * @returns New state with clip trimmed and subsequent clips shifted
 */
export function rippleTrim(
  state: TimelineState,
  clipId: string,
  newEnd: Frame
): TimelineState {
  const clip = findClipById(state, clipId);
  if (!clip) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  
  const track = findTrackById(state, clip.trackId);
  if (!track) {
    throw new Error(`Track not found: ${clip.trackId}`);
  }
  
  if (newEnd <= clip.timelineStart) {
    throw new Error('New end must be after clip start');
  }
  
  // Calculate delta (positive = extended, negative = trimmed)
  const delta = newEnd - clip.timelineEnd;
  
  // Find all clips after this one on the same track
  const clipsToShift = track.clips.filter(c => 
    c.id !== clipId && c.timelineStart >= clip.timelineEnd
  );
  
  // Use transaction to trim and shift
  let tx = beginTransaction(state);
  
  // Resize the clip
  tx = applyOperation(tx, s => resizeClip(s, clipId, clip.timelineStart, newEnd));
  
  // Shift all subsequent clips
  for (const clipToShift of clipsToShift) {
    const newStart = (clipToShift.timelineStart + delta) as Frame;
    tx = applyOperation(tx, s => moveClip(s, clipToShift.id, newStart));
  }
  
  return commitTransaction(tx);
}

/**
 * Insert edit - insert clip and shift all subsequent clips right
 * 
 * @param state - Timeline state
 * @param trackId - Track ID to insert into
 * @param clip - Clip to insert
 * @param atFrame - Frame to insert at
 * @returns New state with clip inserted and subsequent clips shifted
 */
export function insertEdit(
  state: TimelineState,
  trackId: string,
  clip: Clip,
  atFrame: Frame
): TimelineState {
  const track = findTrackById(state, trackId);
  if (!track) {
    throw new Error(`Track not found: ${trackId}`);
  }
  
  const clipDuration = getClipDuration(clip);
  
  // Find all clips at or after the insert point
  const clipsToShift = track.clips.filter(c => c.timelineStart >= atFrame);
  
  // Adjust clip to insert at the specified frame
  const adjustedClip: Clip = {
    ...clip,
    timelineStart: atFrame,
    timelineEnd: (atFrame + clipDuration) as Frame,
  };
  
  // Use transaction to insert and shift
  let tx = beginTransaction(state);
  
  // Shift all subsequent clips right first
  for (const clipToShift of clipsToShift) {
    const newStart = (clipToShift.timelineStart + clipDuration) as Frame;
    tx = applyOperation(tx, s => moveClip(s, clipToShift.id, newStart));
  }
  
  // Add the new clip
  tx = applyOperation(tx, s => addClip(s, trackId, adjustedClip));
  
  return commitTransaction(tx);
}

/**
 * Ripple move - move clip to new position with automatic gap/shift handling
 * 
 * SEMANTICS (based on test contract):
 * 
 * Moving RIGHT (newStart > originalStart):
 *   - Leaves gap at source
 *   - All clips at/after originalEnd shift RIGHT by clipDuration
 *   - Target clip moves to newStart
 * 
 * Moving LEFT (newStart < originalStart):
 *   - Closes gap at source
 *   - All clips at/after originalEnd shift LEFT by clipDuration
 *   - Target clip moves to newStart
 * 
 * @param state - Timeline state
 * @param clipId - Clip ID to move
 * @param newStart - New start frame for the clip
 * @returns New state with clip moved and surrounding clips adjusted
 */
export function rippleMove(
  state: TimelineState,
  clipId: string,
  newStart: Frame
): TimelineState {
  const clip = findClipById(state, clipId);
  if (!clip) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  
  const track = findTrackById(state, clip.trackId);
  if (!track) {
    throw new Error(`Track not found: ${clip.trackId}`);
  }
  
  const clipDuration = getClipDuration(clip);
  const newEnd = (newStart + clipDuration) as Frame;
  
  // Validate bounds
  if (newStart < 0) {
    throw new Error('Cannot move clip before timeline start (frame 0)');
  }
  
  if (newEnd > state.timeline.duration) {
    throw new Error(`Cannot move clip beyond timeline duration (${state.timeline.duration} frames)`);
  }
  
  const originalStart = clip.timelineStart;
  const originalEnd = clip.timelineEnd;
  
  if (newStart === originalStart) {
    return state; // No-op
  }
  
  // Start transaction
  let tx = beginTransaction(state);

  if (newStart > originalStart) {
    // Moving RIGHT — collapse-then-insert ("ripple swap") algorithm:
    //
    // Step 1 — collapse gap at source: shift all clips that start at/after originalEnd
    //           leftward by clipDuration (as if clip was removed).
    const afterSource = track.clips
      .filter(c => c.id !== clipId && c.timelineStart >= originalEnd)
      .sort((a, b) => a.timelineStart - b.timelineStart); // ascending – left first

    for (const other of afterSource) {
      const s = (other.timelineStart - clipDuration) as Frame;
      tx = applyOperation(tx, st => moveClip(st, other.id, s));
    }

    // Step 2 — compute destination in the collapsed timeline.
    //   If clips existed between originalEnd and newStart in the original track, they
    //   have all shifted left by clipDuration so the target frame also shifts left by
    //   clipDuration → collapsedDest = newStart - clipDuration.
    //   If NO clips existed there, the empty space is unchanged and the target frame is
    //   still newStart → collapsedDest = newStart.
    const anyClipBetween = afterSource.some(c => c.timelineStart < newStart);
    const collapsedDest = anyClipBetween
      ? (newStart - clipDuration) as Frame
      : newStart;

    // Step 3 — make room at destination: shift all clips that start at/after collapsedDest
    //           rightward by clipDuration.  Read from the current transaction state so we
    //           have the positions after Step 1.  Process right-to-left to avoid chasing.
    const currentTrack = tx.currentState.timeline.tracks.find(t => t.id === track.id)!;
    const atDest = currentTrack.clips
      .filter(c => c.id !== clipId && c.timelineStart >= collapsedDest)
      .sort((a, b) => b.timelineStart - a.timelineStart); // descending – right first

    for (const other of atDest) {
      const s = (other.timelineStart + clipDuration) as Frame;
      tx = applyOperation(tx, st => moveClip(st, other.id, s));
    }

    // Step 4 — place the clip at its destination in the collapsed timeline.
    tx = applyOperation(tx, st => moveClip(st, clipId, collapsedDest));
  } else {
    // Moving LEFT:
    // Close the gap left behind: shift clips at/after originalEnd leftward by clipDuration.
    const afterSource = track.clips
      .filter(c => c.id !== clipId && c.timelineStart >= originalEnd)
      .sort((a, b) => a.timelineStart - b.timelineStart); // ascending – left first

    for (const other of afterSource) {
      const s = (other.timelineStart - clipDuration) as Frame;
      tx = applyOperation(tx, st => moveClip(st, other.id, s));
    }

    // Place clip at requested position.
    tx = applyOperation(tx, st => moveClip(st, clipId, newStart));
  }

  return commitTransaction(tx);
}

/**
 * Insert move - move clip to new position and shift destination clips right
 * 
 * This differs from ripple move:
 * - Ripple move: closes gap at source, swaps with intermediate clips
 * - Insert move: leaves gap at source, pushes all destination clips right
 * 
 * This is useful for "inserting" a clip into a specific position without
 * affecting the source timeline structure.
 * 
 * All operations are atomic via transaction.
 * 
 * @param state - Timeline state
 * @param clipId - Clip ID to move
 * @param newStart - New start frame for the clip
 * @returns New state with clip moved and destination clips shifted
 * 
 * @example
 * // Timeline before: [A][B*][C]__[D]
 * // Insert move B to position after D
 * // Timeline after: [A]__[C][D][B*]  (gap remains at A)
 */
export function insertMove(
  state: TimelineState,
  clipId: string,
  newStart: Frame
): TimelineState {
  const clip = findClipById(state, clipId);
  if (!clip) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  
  const track = findTrackById(state, clip.trackId);
  if (!track) {
    throw new Error(`Track not found: ${clip.trackId}`);
  }
  
  // Validate new position is within timeline bounds
  const clipDuration = getClipDuration(clip);
  const newEnd = (newStart + clipDuration) as Frame;
  
  if (newStart < 0) {
    throw new Error('Cannot move clip before timeline start (frame 0)');
  }
  
  if (newEnd > state.timeline.duration) {
    throw new Error(`Cannot move clip beyond timeline duration (${state.timeline.duration} frames)`);
  }
  
  // If moving to the same position, no-op
  if (newStart === clip.timelineStart) {
    return state;
  }
  
  // Use transaction for atomicity
  let tx = beginTransaction(state);
  
  // Find all clips at or after the new position (excluding the clip being moved)
  const clipsToShift = track.clips.filter(c => 
    c.id !== clipId && c.timelineStart >= newStart
  );
  
  // Shift destination clips right to make space
  for (const clipToShift of clipsToShift) {
    const shiftedStart = (clipToShift.timelineStart + clipDuration) as Frame;
    tx = applyOperation(tx, s => moveClip(s, clipToShift.id, shiftedStart));
  }
  
  // Move the clip to its new position
  tx = applyOperation(tx, s => moveClip(s, clipId, newStart));
  
  return commitTransaction(tx);
}
