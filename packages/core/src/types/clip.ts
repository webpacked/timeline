import type { TimeMs, ID } from './common';

/**
 * ClipType - The kind of content a clip represents
 * 
 * This is extensible - you can add more types as needed
 * (e.g., 'subtitle', 'effect', 'transition')
 */
export type ClipType = 'video' | 'audio' | 'image' | 'text';

/**
 * Clip - A time-bound entity on a track
 * 
 * WHAT IS IT?
 * A clip represents a piece of content placed at a specific time on a track.
 * Think of it like a video clip in Premiere Pro or a region in Logic Pro.
 * 
 * WHY IT EXISTS:
 * - Represents WHEN something appears, not HOW it renders
 * - Defines the temporal bounds of content
 * - Enables editing operations (move, resize, split, etc.)
 * 
 * KEY CONCEPTS:
 * 
 * 1. START vs TRIM START:
 *    - start: When the clip appears on the TIMELINE
 *    - trimStart: Offset into the SOURCE content
 *    
 *    Example: A 10-second video clip
 *    - sourceId: "video123" (10 seconds long)
 *    - start: 5000ms (appears at 5 seconds on timeline)
 *    - duration: 3000ms (shows for 3 seconds)
 *    - trimStart: 2000ms (starts playing from 2 seconds into the video)
 *    - trimEnd: 5000ms (stops playing at 5 seconds into the video)
 * 
 * 2. POINT vs RANGE CLIPS:
 *    - Range clips: Have duration > 0 (video, audio)
 *    - Point clips: duration = 0 (markers, cue points)
 * 
 * WHAT IT DOESN'T CONTAIN:
 * - The actual media data (that's stored elsewhere)
 * - Rendering instructions (effects, filters, etc.)
 * - Pixel coordinates (that's calculated by the UI)
 */
export interface Clip {
  /** Unique identifier */
  id: ID;
  
  /** Reference to the track this clip belongs to */
  trackId: ID;
  
  /** Type of content */
  type: ClipType;
  
  /** Reference to the source content (file path, URL, or ID) */
  sourceId: string;
  
  // ===== TIME PROPERTIES =====
  
  /** When the clip starts on the TIMELINE (in milliseconds) */
  start: TimeMs;
  
  /** How long the clip lasts on the TIMELINE (in milliseconds) */
  duration: TimeMs;
  
  // ===== TRIMMING (for video/audio) =====
  
  /** 
   * Offset into the SOURCE content where playback starts
   * Example: trimStart = 2000 means start playing from 2 seconds into the source
   */
  trimStart?: TimeMs;
  
  /** 
   * Offset into the SOURCE content where playback ends
   * Example: trimEnd = 5000 means stop playing at 5 seconds into the source
   */
  trimEnd?: TimeMs;
  
  // ===== OPTIONAL PROPERTIES =====
  
  /** Optional label for the clip */
  label?: string;
  
  /** Optional metadata for custom use cases */
  metadata?: Record<string, unknown>;
}

/**
 * Helper function to get the end time of a clip
 * This is a computed property - it's not stored, but calculated on demand
 */
export const getClipEnd = (clip: Clip): TimeMs => {
  return (clip.start + clip.duration) as TimeMs;
};

/**
 * Helper function to get the bounds of a clip
 */
export const getClipBounds = (clip: Clip) => {
  return {
    start: clip.start,
    end: getClipEnd(clip),
  };
};

/**
 * Create a new clip
 * Factory function with sensible defaults
 */
export const createClip = (params: {
  id: ID;
  trackId: ID;
  type: ClipType;
  sourceId: string;
  start: TimeMs;
  duration: TimeMs;
  trimStart?: TimeMs;
  trimEnd?: TimeMs;
  label?: string;
  metadata?: Record<string, unknown>;
}): Clip => {
  const clip: Clip = {
    id: params.id,
    trackId: params.trackId,
    type: params.type,
    sourceId: params.sourceId,
    start: params.start,
    duration: params.duration,
  };
  
  if (params.trimStart !== undefined) {
    clip.trimStart = params.trimStart;
  }
  
  if (params.trimEnd !== undefined) {
    clip.trimEnd = params.trimEnd;
  }
  
  if (params.label !== undefined) {
    clip.label = params.label;
  }
  
  if (params.metadata !== undefined) {
    clip.metadata = params.metadata;
  }
  
  return clip;
};
