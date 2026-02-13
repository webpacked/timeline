/**
 * LINKING SYSTEM
 * 
 * Link groups synchronize edits across multiple clips.
 * When one clip in a link group is moved/deleted, all linked clips are affected.
 * 
 * DESIGN:
 * - Link groups stored in TimelineState.linkGroups
 * - Clips reference group via linkGroupId
 * - Pure functions - no mutations
 * - Linked operations use transactions
 * 
 * USAGE:
 * ```typescript
 * // Create link group
 * state = createLinkGroup(state, ['clip1', 'clip2']);
 * 
 * // Get linked clips
 * const linked = getLinkedClips(state, 'clip1');
 * 
 * // Break link
 * state = breakLinkGroup(state, linkGroupId);
 * ```
 */

import { TimelineState } from '../types/state';
import { LinkGroup } from '../types/linking';
import { Clip } from '../types/clip';
import { generateLinkGroupId } from '../utils/id-phase2';
import { findClipById, getAllClips } from './queries';

/**
 * Create a link group from multiple clips
 * 
 * @param state - Timeline state
 * @param clipIds - Clip IDs to link together
 * @returns New state with link group created
 */
export function createLinkGroup(
  state: TimelineState,
  clipIds: string[]
): TimelineState {
  if (clipIds.length < 2) {
    throw new Error('Link group must contain at least 2 clips');
  }
  
  // Verify all clips exist
  for (const clipId of clipIds) {
    const clip = findClipById(state, clipId);
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`);
    }
  }
  
  // Generate link group ID
  const linkGroupId = generateLinkGroupId();
  
  // Create link group
  const linkGroup: LinkGroup = {
    id: linkGroupId,
    clipIds: [...clipIds],
    createdAt: Date.now(),
  };
  
  // Add link group to state
  const newLinkGroups = new Map(state.linkGroups);
  newLinkGroups.set(linkGroupId, linkGroup);
  
  // Update clips with linkGroupId
  const newTracks = state.timeline.tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => {
      if (clipIds.includes(clip.id)) {
        return { ...clip, linkGroupId };
      }
      return clip;
    }),
  }));
  
  return {
    ...state,
    linkGroups: newLinkGroups,
    timeline: {
      ...state.timeline,
      tracks: newTracks,
    },
  };
}

/**
 * Break a link group
 * 
 * Removes the link group and clears linkGroupId from all clips.
 * 
 * @param state - Timeline state
 * @param linkGroupId - Link group ID to break
 * @returns New state with link group removed
 */
export function breakLinkGroup(
  state: TimelineState,
  linkGroupId: string
): TimelineState {
  const linkGroup = state.linkGroups.get(linkGroupId);
  if (!linkGroup) {
    throw new Error(`Link group not found: ${linkGroupId}`);
  }
  
  // Remove link group
  const newLinkGroups = new Map(state.linkGroups);
  newLinkGroups.delete(linkGroupId);
  
  // Clear linkGroupId from clips
  const newTracks = state.timeline.tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => {
      if (clip.linkGroupId === linkGroupId) {
        const { linkGroupId: _, ...clipWithoutLink } = clip;
        return clipWithoutLink as Clip;
      }
      return clip;
    }),
  }));
  
  return {
    ...state,
    linkGroups: newLinkGroups,
    timeline: {
      ...state.timeline,
      tracks: newTracks,
    },
  };
}

/**
 * Get all clips in the same link group as the given clip
 * 
 * @param state - Timeline state
 * @param clipId - Clip ID to find linked clips for
 * @returns Array of linked clips (including the original clip)
 */
export function getLinkedClips(
  state: TimelineState,
  clipId: string
): Clip[] {
  const clip = findClipById(state, clipId);
  if (!clip || !clip.linkGroupId) {
    return clip ? [clip] : [];
  }
  
  const linkGroup = state.linkGroups.get(clip.linkGroupId);
  if (!linkGroup) {
    return [clip];
  }
  
  // Find all clips in the link group
  const allClips = getAllClips(state);
  return allClips.filter(c => c.linkGroupId === clip.linkGroupId);
}

/**
 * Check if a clip is linked
 * 
 * @param state - Timeline state
 * @param clipId - Clip ID to check
 * @returns True if clip is in a link group
 */
export function isClipLinked(
  state: TimelineState,
  clipId: string
): boolean {
  const clip = findClipById(state, clipId);
  return clip?.linkGroupId !== undefined;
}

/**
 * Get link group by ID
 * 
 * @param state - Timeline state
 * @param linkGroupId - Link group ID
 * @returns Link group or undefined
 */
export function getLinkGroup(
  state: TimelineState,
  linkGroupId: string
): LinkGroup | undefined {
  return state.linkGroups.get(linkGroupId);
}

/**
 * Add clip to existing link group
 * 
 * @param state - Timeline state
 * @param clipId - Clip ID to add
 * @param linkGroupId - Link group ID to add to
 * @returns New state with clip added to link group
 */
export function addClipToLinkGroup(
  state: TimelineState,
  clipId: string,
  linkGroupId: string
): TimelineState {
  const clip = findClipById(state, clipId);
  if (!clip) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  
  const linkGroup = state.linkGroups.get(linkGroupId);
  if (!linkGroup) {
    throw new Error(`Link group not found: ${linkGroupId}`);
  }
  
  // Update link group
  const newLinkGroup: LinkGroup = {
    ...linkGroup,
    clipIds: [...linkGroup.clipIds, clipId],
  };
  
  const newLinkGroups = new Map(state.linkGroups);
  newLinkGroups.set(linkGroupId, newLinkGroup);
  
  // Update clip
  const newTracks = state.timeline.tracks.map(track => ({
    ...track,
    clips: track.clips.map(c => {
      if (c.id === clipId) {
        return { ...c, linkGroupId };
      }
      return c;
    }),
  }));
  
  return {
    ...state,
    linkGroups: newLinkGroups,
    timeline: {
      ...state.timeline,
      tracks: newTracks,
    },
  };
}

/**
 * Remove clip from link group
 * 
 * If this leaves the link group with < 2 clips, the group is deleted.
 * 
 * @param state - Timeline state
 * @param clipId - Clip ID to remove
 * @returns New state with clip removed from link group
 */
export function removeClipFromLinkGroup(
  state: TimelineState,
  clipId: string
): TimelineState {
  const clip = findClipById(state, clipId);
  if (!clip || !clip.linkGroupId) {
    return state; // Clip not linked
  }
  
  const linkGroup = state.linkGroups.get(clip.linkGroupId);
  if (!linkGroup) {
    return state; // Link group doesn't exist
  }
  
  // Remove clip from link group
  const newClipIds = linkGroup.clipIds.filter(id => id !== clipId);
  
  let newLinkGroups = new Map(state.linkGroups);
  
  // If link group has < 2 clips, delete it
  if (newClipIds.length < 2) {
    newLinkGroups.delete(clip.linkGroupId);
  } else {
    newLinkGroups.set(clip.linkGroupId, {
      ...linkGroup,
      clipIds: newClipIds,
    });
  }
  
  // Clear linkGroupId from clip
  const newTracks = state.timeline.tracks.map(track => ({
    ...track,
    clips: track.clips.map(c => {
      if (c.id === clipId) {
        const { linkGroupId: _, ...clipWithoutLink } = c;
        return clipWithoutLink as Clip;
      }
      return c;
    }),
  }));
  
  return {
    ...state,
    linkGroups: newLinkGroups,
    timeline: {
      ...state.timeline,
      tracks: newTracks,
    },
  };
}
