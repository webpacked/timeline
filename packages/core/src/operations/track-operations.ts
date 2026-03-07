/**
 * TRACK OPERATIONS
 * 
 * Pure functions for manipulating tracks in the timeline state.
 * 
 * WHAT ARE TRACK OPERATIONS?
 * - Add/remove tracks
 * - Reorder tracks
 * - Update track properties (name, mute, lock)
 * 
 * ALL OPERATIONS ARE PURE:
 * - Take state as input
 * - Return new state as output
 * - Never mutate input state
 * 
 * USAGE:
 * ```typescript
 * let state = addTrack(state, track);
 * state = moveTrack(state, 'track_1', 2);
 * state = updateTrack(state, 'track_1', { muted: true });
 * state = removeTrack(state, 'track_1');
 * ```
 */

import { TimelineState } from '../types/state';
import { Track } from '../types/track';
import { findTrackIndex } from '../systems/queries';

/**
 * Add a track to the timeline
 * 
 * Adds the track to the end of the tracks array (top layer).
 * 
 * @param state - Current timeline state
 * @param track - Track to add
 * @returns New timeline state with track added
 */
export function addTrack(state: TimelineState, track: Track): TimelineState {
  return {
    ...state,
    timeline: {
      ...state.timeline,
      tracks: [...state.timeline.tracks, track],
    },
  };
}

/**
 * Remove a track from the timeline
 * 
 * WARNING: This also removes all clips on the track.
 * 
 * @param state - Current timeline state
 * @param trackId - ID of the track to remove
 * @returns New timeline state with track removed
 */
export function removeTrack(state: TimelineState, trackId: string): TimelineState {
  return {
    ...state,
    timeline: {
      ...state.timeline,
      tracks: state.timeline.tracks.filter(t => t.id !== trackId),
    },
  };
}

/**
 * Move a track to a new position
 * 
 * Changes the track order (bottom-to-top rendering).
 * 
 * @param state - Current timeline state
 * @param trackId - ID of the track to move
 * @param newIndex - New index position (0 = bottom)
 * @returns New timeline state with track moved
 */
export function moveTrack(
  state: TimelineState,
  trackId: string,
  newIndex: number
): TimelineState {
  const currentIndex = findTrackIndex(state, trackId);
  if (currentIndex === -1) {
    return state;
  }
  
  const newTracks = [...state.timeline.tracks];
  const [track] = newTracks.splice(currentIndex, 1);
  if (!track) {
    return state;
  }
  newTracks.splice(newIndex, 0, track);
  
  return {
    ...state,
    timeline: {
      ...state.timeline,
      tracks: newTracks,
    },
  };
}

/**
 * Update track properties
 * 
 * Generic function to update any track properties.
 * 
 * @param state - Current timeline state
 * @param trackId - ID of the track to update
 * @param updates - Partial track properties to update
 * @returns New timeline state with track updated
 */
export function updateTrack(
  state: TimelineState,
  trackId: string,
  updates: Partial<Track>
): TimelineState {
  const trackIndex = findTrackIndex(state, trackId);
  if (trackIndex === -1) {
    return state;
  }
  
  const newTracks = [...state.timeline.tracks];
  const existingTrack = newTracks[trackIndex];
  if (!existingTrack) {
    return state;
  }
  newTracks[trackIndex] = {
    ...existingTrack,
    ...updates,
  } as Track;
  
  return {
    ...state,
    timeline: {
      ...state.timeline,
      tracks: newTracks,
    },
  };
}

/**
 * Toggle track mute
 * 
 * @param state - Current timeline state
 * @param trackId - ID of the track
 * @returns New timeline state with track mute toggled
 */
export function toggleTrackMute(state: TimelineState, trackId: string): TimelineState {
  const trackIndex = findTrackIndex(state, trackId);
  if (trackIndex === -1) {
    return state;
  }
  
  const track = state.timeline.tracks[trackIndex];
  if (!track) {
    return state;
  }
  
  return updateTrack(state, trackId, { muted: !track.muted });
}

/**
 * Toggle track lock
 * 
 * @param state - Current timeline state
 * @param trackId - ID of the track
 * @returns New timeline state with track lock toggled
 */
export function toggleTrackLock(state: TimelineState, trackId: string): TimelineState {
  const trackIndex = findTrackIndex(state, trackId);
  if (trackIndex === -1) {
    return state;
  }
  
  const track = state.timeline.tracks[trackIndex];
  if (!track) {
    return state;
  }
  
  return updateTrack(state, trackId, { locked: !track.locked });
}

/**
 * Toggle track solo
 * 
 * @param state - Current timeline state
 * @param trackId - ID of the track
 * @returns New timeline state with track solo toggled
 */
export function toggleTrackSolo(state: TimelineState, trackId: string): TimelineState {
  const trackIndex = findTrackIndex(state, trackId);
  if (trackIndex === -1) {
    return state;
  }
  
  const track = state.timeline.tracks[trackIndex];
  if (!track) {
    return state;
  }
  
  return updateTrack(state, trackId, { solo: !track.solo });
}

/**
 * Set track height
 * 
 * @param state - Current timeline state
 * @param trackId - ID of the track
 * @param height - New height in pixels
 * @returns New timeline state with track height updated
 */
export function setTrackHeight(state: TimelineState, trackId: string, height: number): TimelineState {
  return updateTrack(state, trackId, { height: Math.max(40, Math.min(200, height)) });
}
