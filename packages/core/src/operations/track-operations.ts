import type { ID } from '../types/common';
import type { Track } from '../types/track';
import type { Clip } from '../types/clip';
import { sortClipsByTime } from './clip-operations';

/**
 * Track Operations
 * 
 * These are pure functions for manipulating tracks.
 * Like clip operations, they follow the immutable pattern.
 * 
 * KEY CONCEPT: TRACK ORDER MATTERS
 * Tracks are rendered bottom-to-top:
 * - tracks[0] = bottom layer (rendered first)
 * - tracks[n] = top layer (rendered last, appears on top)
 */

/**
 * Add a clip to a track
 * Returns a new track with the clip added
 */
export const addClipToTrack = (track: Track, clip: Clip): Track => {
  // Ensure the clip belongs to this track
  if (clip.trackId !== track.id) {
    throw new Error(`Clip trackId (${clip.trackId}) does not match track id (${track.id})`);
  }
  
  const newClips = [...track.clips, clip];
  
  return {
    ...track,
    clips: sortClipsByTime(newClips),
  };
};

/**
 * Remove a clip from a track by ID
 */
export const removeClipFromTrack = (track: Track, clipId: ID): Track => {
  return {
    ...track,
    clips: track.clips.filter(c => c.id !== clipId),
  };
};

/**
 * Update a clip in a track
 * Finds the clip by ID and replaces it with the new version
 */
export const updateClipInTrack = (track: Track, updatedClip: Clip): Track => {
  return {
    ...track,
    clips: sortClipsByTime(
      track.clips.map(c => c.id === updatedClip.id ? updatedClip : c)
    ),
  };
};

/**
 * Get a clip from a track by ID
 */
export const getClipFromTrack = (track: Track, clipId: ID): Clip | undefined => {
  return track.clips.find(c => c.id === clipId);
};

/**
 * Toggle track mute
 */
export const toggleTrackMute = (track: Track): Track => {
  return {
    ...track,
    muted: !track.muted,
  };
};

/**
 * Toggle track lock
 */
export const toggleTrackLock = (track: Track): Track => {
  return {
    ...track,
    locked: !track.locked,
  };
};

/**
 * Toggle track visibility
 */
export const toggleTrackVisibility = (track: Track): Track => {
  return {
    ...track,
    visible: !track.visible,
  };
};

/**
 * Set track height
 */
export const setTrackHeight = (track: Track, height: number): Track => {
  return {
    ...track,
    height,
  };
};

/**
 * Rename a track
 */
export const renameTrack = (track: Track, name: string): Track => {
  return {
    ...track,
    name,
  };
};

/**
 * Clear all clips from a track
 */
export const clearTrack = (track: Track): Track => {
  return {
    ...track,
    clips: [],
  };
};
