/**
 * CLIPBOARD SYSTEM
 * 
 * Copy/cut/paste operations with ID regeneration.
 * 
 * DESIGN:
 * - Clipboard data is external to timeline state
 * - Paste generates new IDs for all clips
 * - Preserves relative positions
 * - Respects collision rules
 * - Uses transactions for atomicity
 */

import { TimelineState } from '../types/state';
import { Clip } from '../types/clip';
import { Frame } from '../types/frame';
import { generateClipId } from '../utils/id';
import { findClipById } from '../systems/queries';
import { removeClip, addClip } from '../operations/clip-operations';
import { beginTransaction, applyOperation, commitTransaction } from '../engine/transactions';

/**
 * Clipboard data structure
 */
export interface ClipboardData {
  /** Clips in the clipboard */
  clips: Clip[];
  
  /** Relative positions (offset from first clip) */
  relativePositions: Frame[];
  
  /** Timestamp when copied */
  timestamp: number;
}

/**
 * Copy clips to clipboard
 * 
 * @param state - Timeline state
 * @param clipIds - Clip IDs to copy
 * @returns Clipboard data
 */
export function copyClips(
  state: TimelineState,
  clipIds: string[]
): ClipboardData {
  if (clipIds.length === 0) {
    throw new Error('No clips to copy');
  }
  
  // Find all clips
  const clips: Clip[] = [];
  for (const clipId of clipIds) {
    const clip = findClipById(state, clipId);
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`);
    }
    clips.push(clip);
  }
  
  // Sort by timeline start
  clips.sort((a, b) => a.timelineStart - b.timelineStart);
  
  // Calculate relative positions from first clip
  const firstClipStart = clips[0]!.timelineStart;
  const relativePositions = clips.map(c => (c.timelineStart - firstClipStart) as Frame);
  
  return {
    clips,
    relativePositions,
    timestamp: Date.now(),
  };
}

/**
 * Cut clips to clipboard
 * 
 * Copies clips and removes them from timeline.
 * 
 * @param state - Timeline state
 * @param clipIds - Clip IDs to cut
 * @returns New state and clipboard data
 */
export function cutClips(
  state: TimelineState,
  clipIds: string[]
): { state: TimelineState; clipboard: ClipboardData } {
  // Copy first
  const clipboard = copyClips(state, clipIds);
  
  // Remove clips using transaction
  let tx = beginTransaction(state);
  
  for (const clipId of clipIds) {
    tx = applyOperation(tx, s => removeClip(s, clipId));
  }
  
  const newState = commitTransaction(tx);
  
  return { state: newState, clipboard };
}

/**
 * Paste clips from clipboard
 * 
 * Generates new IDs for all clips and respects collision rules.
 * 
 * @param state - Timeline state
 * @param trackId - Track ID to paste into
 * @param atFrame - Frame to paste at
 * @param clipboard - Clipboard data
 * @returns New state with clips pasted
 */
export function pasteClips(
  state: TimelineState,
  trackId: string,
  atFrame: Frame,
  clipboard: ClipboardData
): TimelineState {
  if (clipboard.clips.length === 0) {
    throw new Error('Clipboard is empty');
  }
  
  // Use transaction to paste all clips
  let tx = beginTransaction(state);
  
  for (let i = 0; i < clipboard.clips.length; i++) {
    const originalClip = clipboard.clips[i]!;
    const relativePosition = clipboard.relativePositions[i]!;
    
    // Calculate new position
    const newStart = (atFrame + relativePosition) as Frame;
    const duration = originalClip.timelineEnd - originalClip.timelineStart;
    const newEnd = (newStart + duration) as Frame;
    
    // Create new clip with new ID (omit linking/grouping)
    const { linkGroupId: _, groupId: __, ...clipWithoutGroups } = originalClip;
    const newClip: Clip = {
      ...clipWithoutGroups,
      id: generateClipId(),
      trackId,
      timelineStart: newStart,
      timelineEnd: newEnd,
    };
    
    tx = applyOperation(tx, s => addClip(s, trackId, newClip));
  }
  
  return commitTransaction(tx);
}

/**
 * Duplicate clips
 * 
 * Creates copies of clips with new IDs at an offset position.
 * 
 * @param state - Timeline state
 * @param clipIds - Clip IDs to duplicate
 * @param offset - Frame offset for duplicates
 * @returns New state with clips duplicated
 */
export function duplicateClips(
  state: TimelineState,
  clipIds: string[],
  offset: Frame
): TimelineState {
  if (clipIds.length === 0) {
    throw new Error('No clips to duplicate');
  }
  
  // Use transaction to duplicate all clips
  let tx = beginTransaction(state);
  
  for (const clipId of clipIds) {
    const clip = findClipById(state, clipId);
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`);
    }
    
    // Create duplicate with new ID and offset position (omit linking/grouping)
    const { linkGroupId: _, groupId: __, ...clipWithoutGroups } = clip;
    const duplicate: Clip = {
      ...clipWithoutGroups,
      id: generateClipId(),
      timelineStart: (clip.timelineStart + offset) as Frame,
      timelineEnd: (clip.timelineEnd + offset) as Frame,
    };
    
    tx = applyOperation(tx, s => addClip(s, clip.trackId, duplicate));
  }
  
  return commitTransaction(tx);
}
