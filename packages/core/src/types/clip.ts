/**
 * CLIP MODEL
 * 
 * A Clip represents a time-bound reference to an Asset on a Track.
 * 
 * WHAT IS A CLIP?
 * - A piece of media placed at a specific time on the timeline
 * - References an Asset (the source media)
 * - Defines WHEN it appears (timeline bounds)
 * - Defines WHAT portion of the asset to play (media bounds)
 * 
 * KEY CONCEPTS:
 * 
 * 1. TIMELINE BOUNDS:
 *    - timelineStart: When the clip appears on the timeline
 *    - timelineEnd: When the clip ends on the timeline
 *    - Duration = timelineEnd - timelineStart
 * 
 * 2. MEDIA BOUNDS:
 *    - mediaIn: Start frame in the source asset
 *    - mediaOut: End frame in the source asset
 *    - Defines which portion of the asset to play
 * 
 * EXAMPLE:
 * ```typescript
 * // A 10-second video asset
 * const asset = { id: 'asset_1', duration: frame(300) };  // 300 frames at 30fps
 * 
 * // A clip that shows 3 seconds of the video (frames 60-150)
 * // starting at 5 seconds on the timeline
 * const clip: Clip = {
 *   id: 'clip_1',
 *   assetId: 'asset_1',
 *   trackId: 'track_1',
 *   timelineStart: frame(150),  // 5 seconds * 30fps
 *   timelineEnd: frame(240),    // 8 seconds * 30fps
 *   mediaIn: frame(60),         // Start at 2 seconds into the asset
 *   mediaOut: frame(150),       // End at 5 seconds into the asset
 * };
 * ```
 * 
 * INVARIANTS (Phase 1 - No Speed Remapping):
 * - timelineEnd > timelineStart
 * - mediaOut > mediaIn
 * - timelineEnd - timelineStart === mediaOut - mediaIn (same duration)
 * - mediaOut <= asset.duration (can't exceed asset bounds)
 * - All frame values must be non-negative
 * 
 * FUTURE: When speed remapping is added, the duration constraint will change.
 */

import { Frame } from './frame';

/**
 * Clip - A time-bound reference to an Asset
 */
export interface Clip {
  /** Unique identifier */
  id: string;
  
  /** Reference to the asset this clip uses */
  assetId: string;
  
  /** Reference to the track this clip belongs to */
  trackId: string;
  
  // === TIMELINE BOUNDS (when the clip appears) ===
  
  /** Start frame on the timeline */
  timelineStart: Frame;
  
  /** End frame on the timeline */
  timelineEnd: Frame;
  
  // === MEDIA BOUNDS (which part of the asset to play) ===
  
  /** Start frame in the source asset */
  mediaIn: Frame;
  
  /** End frame in the source asset */
  mediaOut: Frame;
  
  /** Optional label for the clip */
  label?: string;
  
  /** Optional metadata for custom use cases */
  metadata?: Record<string, unknown>;
  
  // === PHASE 2: LINKING & GROUPING ===
  
  /** Optional link group ID - clips in same group move/delete together */
  linkGroupId?: string;
  
  /** Optional group ID - for visual organization */
  groupId?: string;
}

/**
 * Create a new clip
 * 
 * @param params - Clip parameters
 * @returns A new Clip object
 */
export function createClip(params: {
  id: string;
  assetId: string;
  trackId: string;
  timelineStart: Frame;
  timelineEnd: Frame;
  mediaIn: Frame;
  mediaOut: Frame;
  label?: string;
  metadata?: Record<string, unknown>;
}): Clip {
  const clip: Clip = {
    id: params.id,
    assetId: params.assetId,
    trackId: params.trackId,
    timelineStart: params.timelineStart,
    timelineEnd: params.timelineEnd,
    mediaIn: params.mediaIn,
    mediaOut: params.mediaOut,
  };
  
  if (params.label !== undefined) {
    clip.label = params.label;
  }
  
  if (params.metadata !== undefined) {
    clip.metadata = params.metadata;
  }
  
  return clip;
}

/**
 * Get the timeline duration of a clip
 * 
 * @param clip - The clip
 * @returns Duration in frames
 */
export function getClipDuration(clip: Clip): Frame {
  return (clip.timelineEnd - clip.timelineStart) as Frame;
}

/**
 * Get the media duration of a clip
 * 
 * @param clip - The clip
 * @returns Duration in frames
 */
export function getClipMediaDuration(clip: Clip): Frame {
  return (clip.mediaOut - clip.mediaIn) as Frame;
}

/**
 * Check if a clip contains a specific frame on the timeline
 * 
 * @param clip - The clip
 * @param frame - The frame to check
 * @returns true if the frame is within the clip's timeline bounds
 */
export function clipContainsFrame(clip: Clip, frame: Frame): boolean {
  return frame >= clip.timelineStart && frame < clip.timelineEnd;
}

/**
 * Check if two clips overlap on the timeline
 * 
 * @param clip1 - First clip
 * @param clip2 - Second clip
 * @returns true if the clips overlap
 */
export function clipsOverlap(clip1: Clip, clip2: Clip): boolean {
  return clip1.timelineStart < clip2.timelineEnd && clip2.timelineStart < clip1.timelineEnd;
}
