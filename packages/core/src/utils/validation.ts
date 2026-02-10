import type { TimeMs } from '../types/common';
import type { Clip } from '../types/clip';
import type { Timeline } from '../types/timeline';

/**
 * Validation Utilities
 * 
 * These functions validate timeline data to catch errors early.
 * 
 * WHY VALIDATION?
 * - Catch bugs early (before they cause rendering issues)
 * - Provide helpful error messages
 * - Document constraints and invariants
 * 
 * WHEN TO USE:
 * - When accepting user input
 * - When loading data from external sources
 * - When debugging unexpected behavior
 */

/**
 * Validate that a time value is non-negative
 */
export const validateTime = (time: TimeMs, label: string = 'time'): void => {
  if (time < 0) {
    throw new Error(`${label} must be non-negative, got ${time}`);
  }
};

/**
 * Validate that a duration is positive
 */
export const validateDuration = (duration: TimeMs, label: string = 'duration'): void => {
  if (duration <= 0) {
    throw new Error(`${label} must be positive, got ${duration}`);
  }
};

/**
 * Validate that a clip's time properties are valid
 */
export const validateClip = (clip: Clip): void => {
  validateTime(clip.start, 'clip.start');
  validateDuration(clip.duration, 'clip.duration');
  
  if (clip.trimStart !== undefined) {
    validateTime(clip.trimStart, 'clip.trimStart');
  }
  
  if (clip.trimEnd !== undefined) {
    validateTime(clip.trimEnd, 'clip.trimEnd');
    
    if (clip.trimStart !== undefined && clip.trimEnd <= clip.trimStart) {
      throw new Error(`clip.trimEnd (${clip.trimEnd}) must be greater than clip.trimStart (${clip.trimStart})`);
    }
  }
};

/**
 * Validate that a timeline's duration is valid
 */
export const validateTimeline = (timeline: Timeline): void => {
  validateDuration(timeline.duration, 'timeline.duration');
  
  // Validate all clips in all tracks
  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      validateClip(clip);
    }
  }
};

/**
 * Validate that a zoom level is valid
 */
export const validateZoom = (zoom: number): void => {
  if (zoom <= 0) {
    throw new Error(`zoom must be positive, got ${zoom}`);
  }
  if (!isFinite(zoom)) {
    throw new Error(`zoom must be finite, got ${zoom}`);
  }
};
