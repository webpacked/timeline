import type { ID, TimeMs } from '../types/common';
import type { Timeline } from '../types/timeline';
import type { Track } from '../types/track';
import type { Clip } from '../types/clip';
import type { Marker } from '../types/marker';
import { addClipToTrack, removeClipFromTrack, updateClipInTrack } from './track-operations';

/**
 * Timeline Operations
 * 
 * These are higher-level operations that work with the entire timeline.
 * They coordinate changes across multiple tracks and clips.
 * 
 * ARCHITECTURE NOTE:
 * These functions operate at the timeline level, but they use the
 * track and clip operations internally. This creates a clean hierarchy:
 * 
 * Timeline Operations (high-level)
 *   ↓ uses
 * Track Operations (mid-level)
 *   ↓ uses
 * Clip Operations (low-level)
 */

// ===== TRACK MANAGEMENT =====

/**
 * Add a track to the timeline
 * New track is added at the top (end of array)
 */
export const addTrack = (timeline: Timeline, track: Track): Timeline => {
  return {
    ...timeline,
    tracks: [...timeline.tracks, track],
  };
};

/**
 * Remove a track from the timeline by ID
 * Also removes all clips on that track
 */
export const removeTrack = (timeline: Timeline, trackId: ID): Timeline => {
  return {
    ...timeline,
    tracks: timeline.tracks.filter(t => t.id !== trackId),
  };
};

/**
 * Update a track in the timeline
 */
export const updateTrack = (timeline: Timeline, updatedTrack: Track): Timeline => {
  return {
    ...timeline,
    tracks: timeline.tracks.map(t => t.id === updatedTrack.id ? updatedTrack : t),
  };
};

/**
 * Get a track from the timeline by ID
 */
export const getTrack = (timeline: Timeline, trackId: ID): Track | undefined => {
  return timeline.tracks.find(t => t.id === trackId);
};

/**
 * Reorder tracks
 * Move a track from one index to another
 * 
 * Example: moveTrack(timeline, 2, 0)
 * - Moves track at index 2 to index 0 (bottom)
 */
export const moveTrack = (timeline: Timeline, fromIndex: number, toIndex: number): Timeline => {
  if (fromIndex < 0 || fromIndex >= timeline.tracks.length) {
    throw new Error(`Invalid fromIndex ${fromIndex}`);
  }
  
  const tracks = [...timeline.tracks];
  const [movedTrack] = tracks.splice(fromIndex, 1);
  
  if (!movedTrack) {
    throw new Error(`No track found at index ${fromIndex}`);
  }
  
  tracks.splice(toIndex, 0, movedTrack);
  
  return {
    ...timeline,
    tracks,
  };
};

// ===== CLIP MANAGEMENT =====

/**
 * Add a clip to the timeline
 * Finds the appropriate track and adds the clip to it
 */
export const addClip = (timeline: Timeline, clip: Clip): Timeline => {
  const track = getTrack(timeline, clip.trackId);
  
  if (!track) {
    throw new Error(`Track ${clip.trackId} not found`);
  }
  
  if (track.locked) {
    throw new Error(`Cannot add clip to locked track ${track.id}`);
  }
  
  const updatedTrack = addClipToTrack(track, clip);
  return updateTrack(timeline, updatedTrack);
};

/**
 * Remove a clip from the timeline
 * Finds the clip's track and removes it
 */
export const removeClip = (timeline: Timeline, clipId: ID): Timeline => {
  // Find which track contains this clip
  const track = timeline.tracks.find(t => t.clips.some(c => c.id === clipId));
  
  if (!track) {
    throw new Error(`Clip ${clipId} not found in any track`);
  }
  
  if (track.locked) {
    throw new Error(`Cannot remove clip from locked track ${track.id}`);
  }
  
  const updatedTrack = removeClipFromTrack(track, clipId);
  return updateTrack(timeline, updatedTrack);
};

/**
 * Update a clip in the timeline
 * Finds the clip's track and updates it
 */
export const updateClip = (timeline: Timeline, updatedClip: Clip): Timeline => {
  const track = getTrack(timeline, updatedClip.trackId);
  
  if (!track) {
    throw new Error(`Track ${updatedClip.trackId} not found`);
  }
  
  if (track.locked) {
    throw new Error(`Cannot update clip in locked track ${track.id}`);
  }
  
  const updatedTrack = updateClipInTrack(track, updatedClip);
  return updateTrack(timeline, updatedTrack);
};

/**
 * Get a clip from the timeline by ID
 * Searches all tracks for the clip
 */
export const getClip = (timeline: Timeline, clipId: ID): Clip | undefined => {
  for (const track of timeline.tracks) {
    const clip = track.clips.find(c => c.id === clipId);
    if (clip) return clip;
  }
  return undefined;
};

/**
 * Get all clips in the timeline (across all tracks)
 */
export const getAllClips = (timeline: Timeline): Clip[] => {
  return timeline.tracks.flatMap(t => t.clips);
};

// ===== MARKER MANAGEMENT =====

/**
 * Add a marker to the timeline
 */
export const addMarker = (timeline: Timeline, marker: Marker): Timeline => {
  return {
    ...timeline,
    markers: [...timeline.markers, marker].sort((a, b) => a.time - b.time),
  };
};

/**
 * Remove a marker from the timeline
 */
export const removeMarker = (timeline: Timeline, markerId: ID): Timeline => {
  return {
    ...timeline,
    markers: timeline.markers.filter(m => m.id !== markerId),
  };
};

/**
 * Update a marker in the timeline
 */
export const updateMarker = (timeline: Timeline, updatedMarker: Marker): Timeline => {
  return {
    ...timeline,
    markers: timeline.markers
      .map(m => m.id === updatedMarker.id ? updatedMarker : m)
      .sort((a, b) => a.time - b.time),
  };
};

/**
 * Get a marker from the timeline by ID
 */
export const getMarker = (timeline: Timeline, markerId: ID): Marker | undefined => {
  return timeline.markers.find(m => m.id === markerId);
};

// ===== TIMELINE PROPERTIES =====

/**
 * Set the timeline duration
 */
export const setTimelineDuration = (timeline: Timeline, duration: TimeMs): Timeline => {
  return {
    ...timeline,
    duration,
  };
};

/**
 * Rename the timeline
 */
export const renameTimeline = (timeline: Timeline, name: string): Timeline => {
  return {
    ...timeline,
    name,
  };
};
