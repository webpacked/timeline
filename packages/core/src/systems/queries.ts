/**
 * QUERY SYSTEM
 * 
 * Read-only query functions for the timeline state.
 * 
 * WHAT ARE QUERIES?
 * - Pure functions that read data from state
 * - Never mutate state
 * - Provide convenient access to timeline data
 * 
 * WHY QUERIES?
 * - Separate read operations from write operations
 * - Reusable logic for finding clips, tracks, etc.
 * - Makes the codebase easier to understand and test
 * 
 * USAGE:
 * ```typescript
 * const clip = findClipById(state, 'clip_1');
 * const track = findTrackById(state, 'track_1');
 * const clips = getClipsAtFrame(state, frame(150));
 * ```
 * 
 * ALL FUNCTIONS ARE PURE AND READ-ONLY:
 * - Take state as input
 * - Return data (never mutate state)
 * - No side effects
 */

import { TimelineState } from '../types/state';
import { Clip, clipContainsFrame } from '../types/clip';
import { Track } from '../types/track';
import { Frame } from '../types/frame';

/**
 * Find a clip by ID
 * 
 * Searches all tracks for a clip with the given ID.
 * 
 * @param state - Current timeline state
 * @param clipId - ID of the clip to find
 * @returns The clip, or undefined if not found
 */
export function findClipById(state: TimelineState, clipId: string): Clip | undefined {
  for (const track of state.timeline.tracks) {
    const clip = track.clips.find(c => c.id === clipId);
    if (clip) {
      return clip;
    }
  }
  return undefined;
}

/**
 * Find a track by ID
 * 
 * @param state - Current timeline state
 * @param trackId - ID of the track to find
 * @returns The track, or undefined if not found
 */
export function findTrackById(state: TimelineState, trackId: string): Track | undefined {
  return state.timeline.tracks.find(t => t.id === trackId);
}

/**
 * Get all clips on a specific track
 * 
 * @param state - Current timeline state
 * @param trackId - ID of the track
 * @returns Array of clips on the track (empty if track not found)
 */
export function getClipsOnTrack(state: TimelineState, trackId: string): Clip[] {
  const track = findTrackById(state, trackId);
  return track ? track.clips : [];
}

/**
 * Get all clips at a specific frame
 * 
 * Returns all clips that contain the given frame.
 * 
 * @param state - Current timeline state
 * @param frame - The frame to check
 * @returns Array of clips at that frame
 */
export function getClipsAtFrame(state: TimelineState, frame: Frame): Clip[] {
  const clips: Clip[] = [];
  
  for (const track of state.timeline.tracks) {
    for (const clip of track.clips) {
      if (clipContainsFrame(clip, frame)) {
        clips.push(clip);
      }
    }
  }
  
  return clips;
}

/**
 * Get all clips in a frame range
 * 
 * Returns all clips that overlap with the given range.
 * 
 * @param state - Current timeline state
 * @param start - Start frame (inclusive)
 * @param end - End frame (exclusive)
 * @returns Array of clips in the range
 */
export function getClipsInRange(state: TimelineState, start: Frame, end: Frame): Clip[] {
  const clips: Clip[] = [];
  
  for (const track of state.timeline.tracks) {
    for (const clip of track.clips) {
      // Clip overlaps if it starts before range ends and ends after range starts
      if (clip.timelineStart < end && clip.timelineEnd > start) {
        clips.push(clip);
      }
    }
  }
  
  return clips;
}

/**
 * Get all clips in the timeline
 * 
 * @param state - Current timeline state
 * @returns Array of all clips across all tracks
 */
export function getAllClips(state: TimelineState): Clip[] {
  const clips: Clip[] = [];
  
  for (const track of state.timeline.tracks) {
    clips.push(...track.clips);
  }
  
  return clips;
}

/**
 * Get all tracks in the timeline
 * 
 * @param state - Current timeline state
 * @returns Array of all tracks
 */
export function getAllTracks(state: TimelineState): Track[] {
  return state.timeline.tracks;
}

/**
 * Find the index of a track by ID
 * 
 * @param state - Current timeline state
 * @param trackId - ID of the track
 * @returns The index of the track, or -1 if not found
 */
export function findTrackIndex(state: TimelineState, trackId: string): number {
  return state.timeline.tracks.findIndex(t => t.id === trackId);
}
