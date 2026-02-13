/**
 * VALIDATION SYSTEM
 * 
 * Pure functions for validating timeline state integrity.
 * 
 * WHAT IS VALIDATION?
 * - Checks that state meets all invariants and rules
 * - Returns structured errors (doesn't throw exceptions)
 * - Prevents invalid states from entering history
 * 
 * WHY VALIDATE?
 * - Catch errors early before they corrupt state
 * - Provide clear error messages for debugging
 * - Ensure timeline integrity at all times
 * 
 * VALIDATION RULES:
 * 
 * CLIP VALIDATION:
 * - Asset must exist in registry
 * - timelineEnd > timelineStart
 * - mediaOut > mediaIn
 * - mediaOut <= asset.duration
 * - Timeline duration === media duration (Phase 1, no speed)
 * 
 * TRACK VALIDATION:
 * - No overlapping clips
 * - All clips valid
 * 
 * TIMELINE VALIDATION:
 * - FPS > 0
 * - Duration > 0
 * - All tracks valid
 * 
 * USAGE:
 * ```typescript
 * const result = validateClip(state, clip);
 * if (!result.valid) {
 *   console.error('Invalid clip:', result.errors);
 * }
 * ```
 */

import { TimelineState } from '../types/state';
import { Clip, clipsOverlap, getClipDuration, getClipMediaDuration } from '../types/clip';
import { Track } from '../types/track';
import { ValidationResult, validResult, invalidResult, combineResults } from '../types/validation';
import { getAsset } from './asset-registry';

/**
 * Validate a clip
 * 
 * Checks:
 * - Asset exists
 * - Timeline bounds are valid
 * - Media bounds are valid
 * - Media bounds don't exceed asset duration
 * - Timeline duration matches media duration (Phase 1)
 * 
 * @param state - Current timeline state
 * @param clip - Clip to validate
 * @returns Validation result
 */
export function validateClip(state: TimelineState, clip: Clip): ValidationResult {
  const errors: ValidationResult[] = [];
  
  // Check asset exists
  const asset = getAsset(state, clip.assetId);
  if (!asset) {
    errors.push(invalidResult(
      'ASSET_NOT_FOUND',
      `Asset '${clip.assetId}' not found in registry`,
      { clipId: clip.id, assetId: clip.assetId }
    ));
    // Can't continue validation without asset
    return combineResults(...errors);
  }
  
  // Check timeline bounds
  if (clip.timelineEnd <= clip.timelineStart) {
    errors.push(invalidResult(
      'INVALID_TIMELINE_BOUNDS',
      `Clip timeline end (${clip.timelineEnd}) must be greater than start (${clip.timelineStart})`,
      { clipId: clip.id, timelineStart: clip.timelineStart, timelineEnd: clip.timelineEnd }
    ));
  }
  
  // Check media bounds are non-negative
  if (clip.mediaIn < 0) {
    errors.push(invalidResult(
      'INVALID_MEDIA_IN',
      `Clip media in (${clip.mediaIn}) must be >= 0`,
      { clipId: clip.id, mediaIn: clip.mediaIn }
    ));
  }
  
  // Check media bounds
  if (clip.mediaOut <= clip.mediaIn) {
    errors.push(invalidResult(
      'INVALID_MEDIA_BOUNDS',
      `Clip media out (${clip.mediaOut}) must be greater than media in (${clip.mediaIn})`,
      { clipId: clip.id, mediaIn: clip.mediaIn, mediaOut: clip.mediaOut }
    ));
  }
  
  // Check media bounds don't exceed asset duration
  if (clip.mediaOut > asset.duration) {
    errors.push(invalidResult(
      'MEDIA_EXCEEDS_ASSET',
      `Clip media out (${clip.mediaOut}) exceeds asset duration (${asset.duration})`,
      { clipId: clip.id, mediaOut: clip.mediaOut, assetDuration: asset.duration }
    ));
  }
  
  // Check timeline duration matches media duration (Phase 1 - no speed remapping)
  const timelineDuration = getClipDuration(clip);
  const mediaDuration = getClipMediaDuration(clip);
  if (timelineDuration !== mediaDuration) {
    errors.push(invalidResult(
      'DURATION_MISMATCH',
      `Clip timeline duration (${timelineDuration}) must match media duration (${mediaDuration}) in Phase 1`,
      { clipId: clip.id, timelineDuration, mediaDuration }
    ));
  }
  
  return combineResults(...errors);
}

/**
 * Validate a track
 * 
 * Checks:
 * - No overlapping clips
 * - All clips are valid
 * 
 * @param state - Current timeline state
 * @param track - Track to validate
 * @returns Validation result
 */
export function validateTrack(state: TimelineState, track: Track): ValidationResult {
  const errors: ValidationResult[] = [];
  
  // Validate all clips
  for (const clip of track.clips) {
    const clipResult = validateClip(state, clip);
    if (!clipResult.valid) {
      errors.push(clipResult);
    }
  }
  
  // Check for overlapping clips
  for (let i = 0; i < track.clips.length; i++) {
    for (let j = i + 1; j < track.clips.length; j++) {
      const clip1 = track.clips[i];
      const clip2 = track.clips[j];
      
      if (!clip1 || !clip2) {
        continue;
      }
      
      if (clipsOverlap(clip1, clip2)) {
        errors.push(invalidResult(
          'CLIPS_OVERLAP',
          `Clips '${clip1.id}' and '${clip2.id}' overlap on track '${track.id}'`,
          {
            trackId: track.id,
            clip1Id: clip1.id,
            clip2Id: clip2.id,
            clip1Start: clip1.timelineStart,
            clip1End: clip1.timelineEnd,
            clip2Start: clip2.timelineStart,
            clip2End: clip2.timelineEnd,
          }
        ));
      }
    }
  }
  
  return combineResults(...errors);
}

/**
 * Validate the entire timeline
 * 
 * Checks:
 * - FPS is positive
 * - Duration is positive
 * - All tracks are valid
 * 
 * @param state - Current timeline state
 * @returns Validation result
 */
export function validateTimeline(state: TimelineState): ValidationResult {
  const errors: ValidationResult[] = [];
  
  // Check FPS
  if (state.timeline.fps <= 0) {
    errors.push(invalidResult(
      'INVALID_FPS',
      `Timeline FPS must be positive, got ${state.timeline.fps}`,
      { fps: state.timeline.fps }
    ));
  }
  
  // Check duration
  if (state.timeline.duration <= 0) {
    errors.push(invalidResult(
      'INVALID_DURATION',
      `Timeline duration must be positive, got ${state.timeline.duration}`,
      { duration: state.timeline.duration }
    ));
  }
  
  // Validate all tracks
  for (const track of state.timeline.tracks) {
    const trackResult = validateTrack(state, track);
    if (!trackResult.valid) {
      errors.push(trackResult);
    }
  }
  
  return combineResults(...errors);
}

/**
 * Check if adding a clip to a track would cause overlap
 * 
 * This is a helper for operations to check before adding a clip.
 * 
 * @param track - Track to check
 * @param clip - Clip to add
 * @returns Validation result
 */
export function validateNoOverlap(track: Track, clip: Clip): ValidationResult {
  for (const existingClip of track.clips) {
    // Skip if checking against itself
    if (existingClip.id === clip.id) {
      continue;
    }
    
    if (clipsOverlap(existingClip, clip)) {
      return invalidResult(
        'CLIPS_OVERLAP',
        `Clip '${clip.id}' would overlap with existing clip '${existingClip.id}' on track '${track.id}'`,
        {
          trackId: track.id,
          newClipId: clip.id,
          existingClipId: existingClip.id,
          newClipStart: clip.timelineStart,
          newClipEnd: clip.timelineEnd,
          existingClipStart: existingClip.timelineStart,
          existingClipEnd: existingClip.timelineEnd,
        }
      );
    }
  }
  
  return validResult();
}

/**
 * Validate that a clip's asset type matches the target track type
 * 
 * Enforces type constraints:
 * - Video clips can only go on video tracks
 * - Audio clips can only go on audio tracks
 * 
 * @param state - Current timeline state
 * @param clip - Clip to validate
 * @param targetTrack - Target track to check
 * @returns Validation result
 */
export function validateTrackTypeMatch(
  state: TimelineState,
  clip: Clip,
  targetTrack: Track
): ValidationResult {
  const asset = getAsset(state, clip.assetId);
  
  if (!asset) {
    return invalidResult(
      'ASSET_NOT_FOUND',
      `Asset '${clip.assetId}' not found in registry`,
      { clipId: clip.id, assetId: clip.assetId }
    );
  }
  
  // Check if asset type matches track type
  // Note: 'image' assets can go on 'video' tracks
  if (asset.type === 'video' && targetTrack.type !== 'video') {
    return invalidResult(
      'TRACK_TYPE_MISMATCH',
      `Cannot place video clip '${clip.id}' on ${targetTrack.type} track '${targetTrack.id}'`,
      {
        clipId: clip.id,
        assetType: asset.type,
        trackType: targetTrack.type,
        trackId: targetTrack.id,
      }
    );
  }
  
  if (asset.type === 'audio' && targetTrack.type !== 'audio') {
    return invalidResult(
      'TRACK_TYPE_MISMATCH',
      `Cannot place audio clip '${clip.id}' on ${targetTrack.type} track '${targetTrack.id}'`,
      {
        clipId: clip.id,
        assetType: asset.type,
        trackType: targetTrack.type,
        trackId: targetTrack.id,
      }
    );
  }
  
  if (asset.type === 'image' && targetTrack.type !== 'video') {
    return invalidResult(
      'TRACK_TYPE_MISMATCH',
      `Cannot place image clip '${clip.id}' on ${targetTrack.type} track '${targetTrack.id}'`,
      {
        clipId: clip.id,
        assetType: asset.type,
        trackType: targetTrack.type,
        trackId: targetTrack.id,
      }
    );
  }
  
  return validResult();
}
