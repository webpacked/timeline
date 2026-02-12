/**
 * GROUPING SYSTEM
 * 
 * Groups organize clips visually without affecting edit behavior.
 * Unlike link groups, groups are for organization only.
 * 
 * DESIGN:
 * - Groups stored in TimelineState.groups
 * - Clips reference group via groupId
 * - Supports nested groups via parentGroupId
 * - Pure functions - no mutations
 * 
 * USAGE:
 * ```typescript
 * // Create group
 * state = createGroup(state, ['clip1', 'clip2'], 'Scene 1');
 * 
 * // Get grouped clips
 * const clips = getGroupClips(state, groupId);
 * 
 * // Ungroup
 * state = ungroupClips(state, groupId);
 * ```
 */

import { TimelineState } from '../types/state';
import { Group } from '../types/grouping';
import { Clip } from '../types/clip';
import { generateGroupId } from '../utils/id-phase2';
import { findClipById, getAllClips } from './queries';

/**
 * Create a group from multiple clips
 * 
 * @param state - Timeline state
 * @param clipIds - Clip IDs to group together
 * @param name - Group name
 * @param options - Optional group options
 * @returns New state with group created
 */
export function createGroup(
  state: TimelineState,
  clipIds: string[],
  name: string,
  options?: {
    parentGroupId?: string;
    color?: string;
    collapsed?: boolean;
  }
): TimelineState {
  if (clipIds.length < 1) {
    throw new Error('Group must contain at least 1 clip');
  }
  
  // Verify all clips exist
  for (const clipId of clipIds) {
    const clip = findClipById(state, clipId);
    if (!clip) {
      throw new Error(`Clip not found: ${clipId}`);
    }
  }
  
  // Verify parent group exists if specified
  if (options?.parentGroupId) {
    const parentGroup = state.groups.get(options.parentGroupId);
    if (!parentGroup) {
      throw new Error(`Parent group not found: ${options.parentGroupId}`);
    }
  }
  
  // Generate group ID
  const groupId = generateGroupId();
  
  // Create group
  const group: Group = {
    id: groupId,
    name,
    clipIds: [...clipIds],
  };
  
  // Add optional properties only if defined
  if (options?.parentGroupId !== undefined) {
    group.parentGroupId = options.parentGroupId;
  }
  if (options?.color !== undefined) {
    group.color = options.color;
  }
  if (options?.collapsed !== undefined) {
    group.collapsed = options.collapsed;
  }
  
  // Add group to state
  const newGroups = new Map(state.groups);
  newGroups.set(groupId, group);
  
  // Update clips with groupId
  const newTracks = state.timeline.tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => {
      if (clipIds.includes(clip.id)) {
        return { ...clip, groupId };
      }
      return clip;
    }),
  }));
  
  return {
    ...state,
    groups: newGroups,
    timeline: {
      ...state.timeline,
      tracks: newTracks,
    },
  };
}

/**
 * Ungroup clips
 * 
 * Removes the group and clears groupId from all clips.
 * 
 * @param state - Timeline state
 * @param groupId - Group ID to ungroup
 * @returns New state with group removed
 */
export function ungroupClips(
  state: TimelineState,
  groupId: string
): TimelineState {
  const group = state.groups.get(groupId);
  if (!group) {
    throw new Error(`Group not found: ${groupId}`);
  }
  
  // Remove group
  const newGroups = new Map(state.groups);
  newGroups.delete(groupId);
  
  // Also remove any child groups
  for (const [childGroupId, childGroup] of state.groups) {
    if (childGroup.parentGroupId === groupId) {
      newGroups.delete(childGroupId);
    }
  }
  
  // Clear groupId from clips
  const newTracks = state.timeline.tracks.map(track => ({
    ...track,
    clips: track.clips.map(clip => {
      if (clip.groupId === groupId) {
        const { groupId: _, ...clipWithoutGroup } = clip;
        return clipWithoutGroup as Clip;
      }
      return clip;
    }),
  }));
  
  return {
    ...state,
    groups: newGroups,
    timeline: {
      ...state.timeline,
      tracks: newTracks,
    },
  };
}

/**
 * Get all clips in a group
 * 
 * @param state - Timeline state
 * @param groupId - Group ID
 * @returns Array of clips in the group
 */
export function getGroupClips(
  state: TimelineState,
  groupId: string
): Clip[] {
  const group = state.groups.get(groupId);
  if (!group) {
    return [];
  }
  
  const allClips = getAllClips(state);
  return allClips.filter(c => c.groupId === groupId);
}

/**
 * Check if a clip is grouped
 * 
 * @param state - Timeline state
 * @param clipId - Clip ID to check
 * @returns True if clip is in a group
 */
export function isClipGrouped(
  state: TimelineState,
  clipId: string
): boolean {
  const clip = findClipById(state, clipId);
  return clip?.groupId !== undefined;
}

/**
 * Get group by ID
 * 
 * @param state - Timeline state
 * @param groupId - Group ID
 * @returns Group or undefined
 */
export function getGroup(
  state: TimelineState,
  groupId: string
): Group | undefined {
  return state.groups.get(groupId);
}

/**
 * Add clip to existing group
 * 
 * @param state - Timeline state
 * @param clipId - Clip ID to add
 * @param groupId - Group ID to add to
 * @returns New state with clip added to group
 */
export function addClipToGroup(
  state: TimelineState,
  clipId: string,
  groupId: string
): TimelineState {
  const clip = findClipById(state, clipId);
  if (!clip) {
    throw new Error(`Clip not found: ${clipId}`);
  }
  
  const group = state.groups.get(groupId);
  if (!group) {
    throw new Error(`Group not found: ${groupId}`);
  }
  
  // Update group
  const newGroup: Group = {
    ...group,
    clipIds: [...group.clipIds, clipId],
  };
  
  const newGroups = new Map(state.groups);
  newGroups.set(groupId, newGroup);
  
  // Update clip
  const newTracks = state.timeline.tracks.map(track => ({
    ...track,
    clips: track.clips.map(c => {
      if (c.id === clipId) {
        return { ...c, groupId };
      }
      return c;
    }),
  }));
  
  return {
    ...state,
    groups: newGroups,
    timeline: {
      ...state.timeline,
      tracks: newTracks,
    },
  };
}

/**
 * Remove clip from group
 * 
 * @param state - Timeline state
 * @param clipId - Clip ID to remove
 * @returns New state with clip removed from group
 */
export function removeClipFromGroup(
  state: TimelineState,
  clipId: string
): TimelineState {
  const clip = findClipById(state, clipId);
  if (!clip || !clip.groupId) {
    return state; // Clip not grouped
  }
  
  const group = state.groups.get(clip.groupId);
  if (!group) {
    return state; // Group doesn't exist
  }
  
  // Remove clip from group
  const newClipIds = group.clipIds.filter(id => id !== clipId);
  
  const newGroups = new Map(state.groups);
  newGroups.set(clip.groupId, {
    ...group,
    clipIds: newClipIds,
  });
  
  // Clear groupId from clip
  const newTracks = state.timeline.tracks.map(track => ({
    ...track,
    clips: track.clips.map(c => {
      if (c.id === clipId) {
        const { groupId: _, ...clipWithoutGroup } = c;
        return clipWithoutGroup as Clip;
      }
      return c;
    }),
  }));
  
  return {
    ...state,
    groups: newGroups,
    timeline: {
      ...state.timeline,
      tracks: newTracks,
    },
  };
}

/**
 * Rename a group
 * 
 * @param state - Timeline state
 * @param groupId - Group ID
 * @param newName - New group name
 * @returns New state with group renamed
 */
export function renameGroup(
  state: TimelineState,
  groupId: string,
  newName: string
): TimelineState {
  const group = state.groups.get(groupId);
  if (!group) {
    throw new Error(`Group not found: ${groupId}`);
  }
  
  const newGroups = new Map(state.groups);
  newGroups.set(groupId, {
    ...group,
    name: newName,
  });
  
  return {
    ...state,
    groups: newGroups,
  };
}

/**
 * Get all child groups of a parent group
 * 
 * @param state - Timeline state
 * @param parentGroupId - Parent group ID
 * @returns Array of child groups
 */
export function getChildGroups(
  state: TimelineState,
  parentGroupId: string
): Group[] {
  const childGroups: Group[] = [];
  
  for (const group of state.groups.values()) {
    if (group.parentGroupId === parentGroupId) {
      childGroups.push(group);
    }
  }
  
  return childGroups;
}
