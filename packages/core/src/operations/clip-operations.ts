/**
 * CLIP OPERATIONS
 * 
 * Pure functions for manipulating clips in the timeline state.
 * 
 * WHAT ARE OPERATIONS?
 * - Pure functions that transform state
 * - Take current state, return new state
 * - Never mutate input state
 * - No side effects
 * 
 * WHY PURE OPERATIONS?
 * - Predictable and testable
 * - Can be composed together
 * - Easy to undo/redo (just store snapshots)
 * - No hidden state changes
 * 
 * IMPORTANT:
 * These operations do NOT validate. Validation happens at the
 * dispatch layer. Operations assume inputs are valid.
 * 
 * USAGE:
 * ```typescript
 * let state = addClip(state, 'track_1', clip);
 * state = moveClip(state, 'clip_1', frame(200));
 * state = removeClip(state, 'clip_1');
 * ```
 */

import { TimelineState } from '../types/state';
import { Clip } from '../types/clip';
import { Frame } from '../types/frame';
import { findTrackById, findClipById } from '../systems/queries';
import { sortTrackClips } from '../types/track';
import { validateTrackTypeMatch } from '../systems/validation';

/**
 * Add a clip to a track
 * 
 * Creates a new state with the clip added to the specified track.
 * The track's clips are sorted by timeline start after adding.
 * 
 * @param state - Current timeline state
 * @param trackId - ID of the track to add to
 * @param clip - Clip to add
 * @returns New timeline state with clip added
 */
export function addClip(state: TimelineState, trackId: string, clip: Clip): TimelineState {
  const trackIndex = state.timeline.tracks.findIndex(t => t.id === trackId);
  if (trackIndex === -1) {
    // Track not found, return state unchanged
    return state;
  }
  
  const track = state.timeline.tracks[trackIndex];
  if (!track) {
    return state;
  }
  
  const newTrack = sortTrackClips({
    ...track,
    clips: [...track.clips, clip],
  });
  
  const newTracks = [...state.timeline.tracks];
  newTracks[trackIndex] = newTrack;
  
  return {
    ...state,
    timeline: {
      ...state.timeline,
      tracks: newTracks,
    },
  };
}

/**
 * Remove a clip from the timeline
 * 
 * Searches all tracks and removes the clip with the given ID.
 * 
 * @param state - Current timeline state
 * @param clipId - ID of the clip to remove
 * @returns New timeline state with clip removed
 */
export function removeClip(state: TimelineState, clipId: string): TimelineState {
  const newTracks = state.timeline.tracks.map(track => ({
    ...track,
    clips: track.clips.filter(c => c.id !== clipId),
  }));
  
  return {
    ...state,
    timeline: {
      ...state.timeline,
      tracks: newTracks,
    },
  };
}

/**
 * Move a clip to a new timeline position
 * 
 * Moves the clip by updating its timelineStart and timelineEnd.
 * The media bounds (mediaIn/mediaOut) remain unchanged.
 * 
 * @param state - Current timeline state
 * @param clipId - ID of the clip to move
 * @param newStart - New timeline start frame
 * @returns New timeline state with clip moved
 */
export function moveClip(state: TimelineState, clipId: string, newStart: Frame): TimelineState {
  const clip = findClipById(state, clipId);
  if (!clip) {
    return state;
  }
  
  const duration = clip.timelineEnd - clip.timelineStart;
  const newEnd = (newStart + duration) as Frame;
  
  return updateClip(state, clipId, {
    timelineStart: newStart,
    timelineEnd: newEnd,
  });
}

/**
 * Resize a clip by changing its timeline bounds
 * 
 * This adjusts the timeline bounds AND the corresponding media bounds
 * to maintain the Phase 1 invariant: timeline duration === media duration.
 * 
 * Left resize: Updates timelineStart and mediaIn
 * Right resize: Updates timelineEnd and mediaOut
 * 
 * @param state - Current timeline state
 * @param clipId - ID of the clip to resize
 * @param newStart - New timeline start frame
 * @param newEnd - New timeline end frame
 * @returns New timeline state with clip resized
 */
export function resizeClip(
  state: TimelineState,
  clipId: string,
  newStart: Frame,
  newEnd: Frame
): TimelineState {
  const clip = findClipById(state, clipId);
  if (!clip) {
    return state;
  }
  
  // Calculate deltas to determine which edge moved
  const startDelta = newStart - clip.timelineStart;
  const endDelta = newEnd - clip.timelineEnd;
  
  // Calculate new media bounds based on timeline changes
  // Phase 1 invariant: timeline duration === media duration
  let newMediaIn = clip.mediaIn;
  let newMediaOut = clip.mediaOut;
  
  if (startDelta !== 0) {
    // Left edge moved - adjust mediaIn
    newMediaIn = (clip.mediaIn + startDelta) as Frame;
  }
  
  if (endDelta !== 0) {
    // Right edge moved - adjust mediaOut
    newMediaOut = (clip.mediaOut + endDelta) as Frame;
  }
  
  return updateClip(state, clipId, {
    timelineStart: newStart,
    timelineEnd: newEnd,
    mediaIn: newMediaIn,
    mediaOut: newMediaOut,
  });
}

/**
 * Trim a clip by changing its media bounds
 * 
 * This adjusts which portion of the source asset is played.
 * The timeline bounds remain unchanged.
 * 
 * @param state - Current timeline state
 * @param clipId - ID of the clip to trim
 * @param newMediaIn - New media in frame
 * @param newMediaOut - New media out frame
 * @returns New timeline state with clip trimmed
 */
export function trimClip(
  state: TimelineState,
  clipId: string,
  newMediaIn: Frame,
  newMediaOut: Frame
): TimelineState {
  return updateClip(state, clipId, {
    mediaIn: newMediaIn,
    mediaOut: newMediaOut,
  });
}

/**
 * Update clip properties
 * 
 * Generic function to update any clip properties.
 * 
 * @param state - Current timeline state
 * @param clipId - ID of the clip to update
 * @param updates - Partial clip properties to update
 * @returns New timeline state with clip updated
 */
export function updateClip(
  state: TimelineState,
  clipId: string,
  updates: Partial<Clip>
): TimelineState {
  const newTracks = state.timeline.tracks.map(track => {
    const clipIndex = track.clips.findIndex(c => c.id === clipId);
    if (clipIndex === -1) {
      return track;
    }
    
    const newClips = [...track.clips];
    const existingClip = newClips[clipIndex];
    if (!existingClip) {
      return track;
    }
    newClips[clipIndex] = {
      ...existingClip,
      ...updates,
    } as Clip;
    
    return sortTrackClips({
      ...track,
      clips: newClips,
    });
  });
  
  return {
    ...state,
    timeline: {
      ...state.timeline,
      tracks: newTracks,
    },
  };
}

/**
 * Move a clip to a different track
 * 
 * Removes the clip from its current track and adds it to the target track.
 * 
 * If validation fails (e.g., track type mismatch), returns state unchanged.
 * The dispatcher will catch validation errors after the operation completes.
 * 
 * @param state - Current timeline state
 * @param clipId - ID of the clip to move
 * @param targetTrackId - ID of the target track
 * @returns New timeline state with clip moved to new track, or unchanged state if validation fails
 */
export function moveClipToTrack(
  state: TimelineState,
  clipId: string,
  targetTrackId: string
): TimelineState {
  const clip = findClipById(state, clipId);
  if (!clip) {
    // Clip not found - return unchanged state
    // Validation will catch this
    return state;
  }
  
  const targetTrack = findTrackById(state, targetTrackId);
  if (!targetTrack) {
    // Target track not found - return unchanged state
    // Validation will catch this
    return state;
  }
  
  // Validate track type match
  const validationResult = validateTrackTypeMatch(state, clip, targetTrack);
  if (!validationResult.valid) {
    // Track type mismatch - return unchanged state
    // Validation will catch this and provide proper error details
    return state;
  }
  
  // Don't move if already on target track
  if (clip.trackId === targetTrackId) {
    return state;
  }
  
  // Remove from current track
  let newState = removeClip(state, clipId);
  
  // Update clip's trackId and add to new track
  const updatedClip = { ...clip, trackId: targetTrackId };
  newState = addClip(newState, targetTrackId, updatedClip);
  
  return newState;
}
