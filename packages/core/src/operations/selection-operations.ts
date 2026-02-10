import type { ID } from '../types/common';
import type { SelectionState } from '../types/selection';
import type { Clip } from '../types/clip';
import type { Track } from '../types/track';

/**
 * Selection Operations
 * 
 * These functions manage what entities are currently selected.
 * Selection is separate from timeline content - it's editing state.
 * 
 * WHY SEPARATE?
 * - Selection is temporary (doesn't need to be saved)
 * - Multiple UIs can have different selections
 * - Easier to implement undo/redo
 */

// ===== CLIP SELECTION =====

/**
 * Select a single clip (clears previous selection)
 */
export const selectClip = (state: SelectionState, clipId: ID): SelectionState => {
  return {
    ...state,
    clipIds: new Set([clipId]),
  };
};

/**
 * Add a clip to the selection (multi-select)
 */
export const addClipToSelection = (state: SelectionState, clipId: ID): SelectionState => {
  const newClipIds = new Set(state.clipIds);
  newClipIds.add(clipId);
  
  return {
    ...state,
    clipIds: newClipIds,
  };
};

/**
 * Remove a clip from the selection
 */
export const removeClipFromSelection = (state: SelectionState, clipId: ID): SelectionState => {
  const newClipIds = new Set(state.clipIds);
  newClipIds.delete(clipId);
  
  return {
    ...state,
    clipIds: newClipIds,
  };
};

/**
 * Toggle clip selection (add if not selected, remove if selected)
 */
export const toggleClipSelection = (state: SelectionState, clipId: ID): SelectionState => {
  if (state.clipIds.has(clipId)) {
    return removeClipFromSelection(state, clipId);
  } else {
    return addClipToSelection(state, clipId);
  }
};

/**
 * Select multiple clips at once
 */
export const selectClips = (state: SelectionState, clipIds: ID[]): SelectionState => {
  return {
    ...state,
    clipIds: new Set(clipIds),
  };
};

// ===== TRACK SELECTION =====

/**
 * Select a single track (clears previous selection)
 */
export const selectTrack = (state: SelectionState, trackId: ID): SelectionState => {
  return {
    ...state,
    trackIds: new Set([trackId]),
  };
};

/**
 * Add a track to the selection
 */
export const addTrackToSelection = (state: SelectionState, trackId: ID): SelectionState => {
  const newTrackIds = new Set(state.trackIds);
  newTrackIds.add(trackId);
  
  return {
    ...state,
    trackIds: newTrackIds,
  };
};

/**
 * Remove a track from the selection
 */
export const removeTrackFromSelection = (state: SelectionState, trackId: ID): SelectionState => {
  const newTrackIds = new Set(state.trackIds);
  newTrackIds.delete(trackId);
  
  return {
    ...state,
    trackIds: newTrackIds,
  };
};

/**
 * Toggle track selection
 */
export const toggleTrackSelection = (state: SelectionState, trackId: ID): SelectionState => {
  if (state.trackIds.has(trackId)) {
    return removeTrackFromSelection(state, trackId);
  } else {
    return addTrackToSelection(state, trackId);
  }
};

// ===== CLEAR SELECTION =====

/**
 * Clear all selections
 */
export const clearSelection = (state: SelectionState): SelectionState => {
  return {
    clipIds: new Set(),
    trackIds: new Set(),
  };
};

/**
 * Clear only clip selection
 */
export const clearClipSelection = (state: SelectionState): SelectionState => {
  return {
    ...state,
    clipIds: new Set(),
  };
};

/**
 * Clear only track selection
 */
export const clearTrackSelection = (state: SelectionState): SelectionState => {
  return {
    ...state,
    trackIds: new Set(),
  };
};

// ===== TIME RANGE SELECTION =====

/**
 * Set a time range selection
 */
export const setTimeRangeSelection = (
  state: SelectionState,
  start: number,
  end: number,
  trackIds?: ID[]
): SelectionState => {
  const timeRange: { start: number; end: number; trackIds?: ID[] } = { start, end };
  
  if (trackIds !== undefined) {
    timeRange.trackIds = trackIds;
  }
  
  return {
    ...state,
    timeRange,
  };
};

/**
 * Clear time range selection
 */
export const clearTimeRangeSelection = (state: SelectionState): SelectionState => {
  const { timeRange, ...rest } = state;
  return rest;
};

// ===== BULK OPERATIONS =====

/**
 * Select all clips in a track
 */
export const selectAllClipsInTrack = (state: SelectionState, track: Track): SelectionState => {
  const clipIds = new Set([...state.clipIds, ...track.clips.map(c => c.id)]);
  
  return {
    ...state,
    clipIds,
  };
};

/**
 * Select all clips in multiple tracks
 */
export const selectAllClipsInTracks = (state: SelectionState, tracks: Track[]): SelectionState => {
  const clipIds = new Set([
    ...state.clipIds,
    ...tracks.flatMap(t => t.clips.map(c => c.id)),
  ]);
  
  return {
    ...state,
    clipIds,
  };
};

/**
 * Get selected clips from a list of clips
 */
export const getSelectedClips = (state: SelectionState, clips: Clip[]): Clip[] => {
  return clips.filter(c => state.clipIds.has(c.id));
};

/**
 * Get selected tracks from a list of tracks
 */
export const getSelectedTracks = (state: SelectionState, tracks: Track[]): Track[] => {
  return tracks.filter(t => state.trackIds.has(t.id));
};
