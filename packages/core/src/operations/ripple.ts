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
import { Frame } from '../types/frame';
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
