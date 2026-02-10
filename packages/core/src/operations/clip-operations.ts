import type { TimeMs, ID } from '../types/common';
import type { Clip } from '../types/clip';
import type { Track } from '../types/track';
import { getClipEnd } from '../types/clip';
import { validateClip } from '../utils/validation';

/**
 * Clip Operations
 * 
 * These are pure functions for manipulating clips.
 * They follow the immutable pattern: they don't modify the input,
 * they return new objects with the changes applied.
 * 
 * WHY IMMUTABLE?
 * - Predictable: you know exactly what changed
 * - Testable: easy to verify inputs and outputs
 * - Undo-friendly: you can keep old states
 * - Framework-friendly: React/Vue can detect changes
 * 
 * PATTERN:
 * ❌ BAD: clip.start = newTime (mutates)
 * ✅ GOOD: moveClip(clip, newTime) (returns new clip)
 */

/**
 * Move a clip to a new start time
 * Duration stays the same, only the start time changes
 */
export const moveClip = (clip: Clip, newStart: TimeMs): Clip => {
  return {
    ...clip,
    start: newStart,
  };
};

/**
 * Resize a clip by changing its duration
 * The start time stays the same
 */
export const resizeClip = (clip: Clip, newDuration: TimeMs): Clip => {
  return {
    ...clip,
    duration: newDuration,
  };
};

/**
 * Resize a clip from the left (changes both start and duration)
 * The end time stays the same
 * 
 * Example:
 * - Original: start=1000, duration=2000, end=3000
 * - Resize left to 1500: start=1500, duration=1500, end=3000
 */
export const resizeClipLeft = (clip: Clip, newStart: TimeMs): Clip => {
  const end = getClipEnd(clip);
  const newDuration = (end - newStart) as TimeMs;
  
  return {
    ...clip,
    start: newStart,
    duration: newDuration,
  };
};

/**
 * Resize a clip from the right (changes duration only)
 * The start time stays the same
 * 
 * Example:
 * - Original: start=1000, duration=2000, end=3000
 * - Resize right to 3500: start=1000, duration=2500, end=3500
 */
export const resizeClipRight = (clip: Clip, newEnd: TimeMs): Clip => {
  const newDuration = (newEnd - clip.start) as TimeMs;
  
  return {
    ...clip,
    duration: newDuration,
  };
};

/**
 * Split a clip at a given time
 * Returns two new clips: [left, right]
 * 
 * Example:
 * - Original: start=1000, duration=3000, end=4000
 * - Split at 2500: 
 *   - Left: start=1000, duration=1500, end=2500
 *   - Right: start=2500, duration=1500, end=4000
 * 
 * IMPORTANT: This also handles trimming correctly
 * If the original clip has trimStart/trimEnd, the split clips
 * will have adjusted trim values
 */
export const splitClip = (
  clip: Clip,
  splitTime: TimeMs,
  generateId: (prefix: string) => ID
): [Clip, Clip] => {
  const end = getClipEnd(clip);
  
  // Validate split time is within clip bounds
  if (splitTime <= clip.start || splitTime >= end) {
    throw new Error(`Split time ${splitTime} must be within clip bounds [${clip.start}, ${end}]`);
  }
  
  // Calculate durations for left and right clips
  const leftDuration = (splitTime - clip.start) as TimeMs;
  const rightDuration = (end - splitTime) as TimeMs;
  
  // Calculate trim offsets if the clip has trimming
  const leftTrimStart = clip.trimStart ?? (0 as TimeMs);
  
  // Create left clip
  const leftClip: Clip = {
    ...clip,
    id: generateId('clip'),
    duration: leftDuration,
    trimStart: leftTrimStart,
  };
  
  if (clip.trimStart !== undefined) {
    leftClip.trimEnd = (clip.trimStart + leftDuration) as TimeMs;
  }
  
  // Create right clip
  const rightClip: Clip = {
    ...clip,
    id: generateId('clip'),
    start: splitTime,
    duration: rightDuration,
  };
  
  if (clip.trimStart !== undefined) {
    rightClip.trimStart = (clip.trimStart + leftDuration) as TimeMs;
  }
  
  if (clip.trimEnd !== undefined) {
    rightClip.trimEnd = clip.trimEnd;
  }
  
  return [leftClip, rightClip];
};

/**
 * Trim a clip (adjust trimStart and trimEnd)
 * This is different from resize - trim affects what part of the SOURCE is played
 * 
 * Example: A 10-second video clip
 * - Original: start=0, duration=10000, trimStart=0, trimEnd=10000
 * - Trim to middle 5 seconds: start=0, duration=5000, trimStart=2500, trimEnd=7500
 */
export const trimClip = (
  clip: Clip,
  trimStart?: TimeMs,
  trimEnd?: TimeMs
): Clip => {
  const result: Clip = {
    ...clip,
  };
  
  if (trimStart !== undefined) {
    result.trimStart = trimStart;
  }
  
  if (trimEnd !== undefined) {
    result.trimEnd = trimEnd;
  }
  
  return result;
};

/**
 * Move a clip to a different track
 */
export const moveClipToTrack = (clip: Clip, newTrackId: ID): Clip => {
  return {
    ...clip,
    trackId: newTrackId,
  };
};

/**
 * Offset a clip by a delta (move it forward or backward)
 * Positive delta = move forward, negative = move backward
 */
export const offsetClip = (clip: Clip, delta: TimeMs): Clip => {
  return {
    ...clip,
    start: (clip.start + delta) as TimeMs,
  };
};

/**
 * Check if two clips overlap in time
 */
export const clipsOverlap = (clip1: Clip, clip2: Clip): boolean => {
  const end1 = getClipEnd(clip1);
  const end2 = getClipEnd(clip2);
  
  return clip1.start < end2 && clip2.start < end1;
};

/**
 * Check if a clip contains a specific time
 */
export const clipContainsTime = (clip: Clip, time: TimeMs): boolean => {
  const end = getClipEnd(clip);
  return time >= clip.start && time < end;
};

/**
 * Get all clips that overlap with a time range
 */
export const getClipsInRange = (
  clips: Clip[],
  start: TimeMs,
  end: TimeMs
): Clip[] => {
  return clips.filter(clip => {
    const clipEnd = getClipEnd(clip);
    return clip.start < end && clipEnd > start;
  });
};

/**
 * Sort clips by start time (earliest first)
 */
export const sortClipsByTime = (clips: Clip[]): Clip[] => {
  return [...clips].sort((a, b) => a.start - b.start);
};
