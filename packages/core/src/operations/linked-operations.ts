/**
 * LINKED OPERATIONS
 * 
 * Operations that affect all clips in a link group together.
 * These compose basic operations using transactions.
 * 
 * DESIGN:
 * - Use transactions to batch multiple operations
 * - Preserve relative positions/timing
 * - Respect Phase 1 collision rules
 * - Pure functions - no mutations
 */

import { TimelineState } from '../types/state';
import { Frame } from '../types/frame';
import { getLinkedClips } from '../systems/linking';
import { moveClip, removeClip } from './clip-operations';
import { beginTransaction, applyOperation, commitTransaction } from '../engine/transactions';

/**
 * Move all clips in a link group together
 * 
 * Maintains relative positions between linked clips.
 * 
 * @param state - Timeline state
 * @param clipId - Any clip in the link group
 * @param newStart - New start position for the specified clip
 * @returns New state with all linked clips moved
 */
export function moveLinkedClips(
  state: TimelineState,
  clipId: string,
  newStart: Frame
): TimelineState {
  const linkedClips = getLinkedClips(state, clipId);
  
  if (linkedClips.length === 0) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  
  // If only one clip (not linked), use basic move
  if (linkedClips.length === 1) {
    return moveClip(state, clipId, newStart);
  }
  
  // Find the reference clip
  const referenceClip = linkedClips.find(c => c.id === clipId);
  if (!referenceClip) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  
  // Calculate delta
  const delta = (newStart - referenceClip.timelineStart) as Frame;
  
  // Use transaction to move all clips
  let tx = beginTransaction(state);
  
  for (const clip of linkedClips) {
    const newClipStart = (clip.timelineStart + delta) as Frame;
    tx = applyOperation(tx, s => moveClip(s, clip.id, newClipStart));
  }
  
  return commitTransaction(tx);
}

/**
 * Delete all clips in a link group together
 * 
 * @param state - Timeline state
 * @param clipId - Any clip in the link group
 * @returns New state with all linked clips deleted
 */
export function deleteLinkedClips(
  state: TimelineState,
  clipId: string
): TimelineState {
  const linkedClips = getLinkedClips(state, clipId);
  
  if (linkedClips.length === 0) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  
  // If only one clip (not linked), use basic remove
  if (linkedClips.length === 1) {
    return removeClip(state, clipId);
  }
  
  // Use transaction to delete all clips
  let tx = beginTransaction(state);
  
  for (const clip of linkedClips) {
    tx = applyOperation(tx, s => removeClip(s, clip.id));
  }
  
  return commitTransaction(tx);
}

/**
 * Offset all clips in a link group by a delta
 * 
 * Useful for nudging linked clips together.
 * 
 * @param state - Timeline state
 * @param clipId - Any clip in the link group
 * @param deltaFrames - Frames to offset by (can be negative)
 * @returns New state with all linked clips offset
 */
export function offsetLinkedClips(
  state: TimelineState,
  clipId: string,
  deltaFrames: Frame
): TimelineState {
  const linkedClips = getLinkedClips(state, clipId);
  
  if (linkedClips.length === 0) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  
  // Use transaction to offset all clips
  let tx = beginTransaction(state);
  
  for (const clip of linkedClips) {
    const newStart = (clip.timelineStart + deltaFrames) as Frame;
    tx = applyOperation(tx, s => moveClip(s, clip.id, newStart));
  }
  
  return commitTransaction(tx);
}
