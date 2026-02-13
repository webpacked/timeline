/**
 * TRACK MODEL
 * 
 * A Track is a horizontal container for Clips.
 * 
 * WHAT IS A TRACK?
 * - A layer that holds clips (like a layer in Photoshop)
 * - Provides organization and isolation for clips
 * - Has a type (video or audio) that clips must match
 * 
 * WHY TRACKS?
 * - Organize clips into layers
 * - Enable stacking and compositing (track order matters)
 * - Provide track-level controls (mute, lock)
 * - Isolate editing operations
 * 
 * TRACK ORDER:
 * Tracks are rendered bottom-to-top:
 * - tracks[0] = bottom layer (rendered first)
 * - tracks[n] = top layer (rendered last, appears on top)
 * 
 * EXAMPLE:
 * ```typescript
 * const track: Track = {
 *   id: 'track_1',
 *   name: 'Video Track 1',
 *   type: 'video',
 *   clips: [],
 *   locked: false,
 *   muted: false,
 * };
 * ```
 * 
 * INVARIANTS:
 * - Clips on a track must not overlap
 * - All clips must match the track type
 * - Clips array should be sorted by timelineStart (for performance)
 */

import { Clip } from './clip';

/**
 * TrackType - The kind of content this track holds
 */
export type TrackType = 'video' | 'audio';

/**
 * Track - A container for clips
 */
export interface Track {
  /** Unique identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Type of content this track holds */
  type: TrackType;
  
  /** Clips on this track (should be sorted by timelineStart) */
  clips: Clip[];
  
  /** Whether the track is locked (prevents editing) */
  locked: boolean;
  
  /** Whether the track is muted (affects playback) */
  muted: boolean;
  
  /** Optional metadata for custom use cases */
  metadata?: Record<string, unknown>;
}

/**
 * Create a new track
 * 
 * @param params - Track parameters
 * @returns A new Track object
 */
export function createTrack(params: {
  id: string;
  name: string;
  type: TrackType;
  clips?: Clip[];
  locked?: boolean;
  muted?: boolean;
  metadata?: Record<string, unknown>;
}): Track {
  const track: Track = {
    id: params.id,
    name: params.name,
    type: params.type,
    clips: params.clips ?? [],
    locked: params.locked ?? false,
    muted: params.muted ?? false,
  };
  
  if (params.metadata !== undefined) {
    track.metadata = params.metadata;
  }
  
  return track;
}

/**
 * Sort clips on a track by timeline start frame
 * 
 * This is useful for maintaining clip order and improving
 * query performance.
 * 
 * @param track - The track to sort
 * @returns A new track with sorted clips
 */
export function sortTrackClips(track: Track): Track {
  return {
    ...track,
    clips: [...track.clips].sort((a, b) => a.timelineStart - b.timelineStart),
  };
}
