import type { TimeMs } from '../types/common';

/**
 * Time Utilities
 * 
 * These are pure functions for working with time values.
 * They handle conversions between different time units and provide
 * common time calculations.
 * 
 * WHY THESE EXIST:
 * - Centralize time conversion logic
 * - Prevent errors from manual calculations
 * - Make code more readable (msToSeconds(time) vs time / 1000)
 */

/**
 * Convert milliseconds to seconds
 */
export const msToSeconds = (ms: TimeMs): number => {
  return ms / 1000;
};

/**
 * Convert seconds to milliseconds
 */
export const secondsToMs = (seconds: number): TimeMs => {
  return (seconds * 1000) as TimeMs;
};

/**
 * Convert milliseconds to frames
 * @param ms - Time in milliseconds
 * @param fps - Frames per second (e.g., 24, 30, 60)
 */
export const msToFrames = (ms: TimeMs, fps: number): number => {
  return (ms / 1000) * fps;
};

/**
 * Convert frames to milliseconds
 * @param frames - Frame number
 * @param fps - Frames per second
 */
export const framesToMs = (frames: number, fps: number): TimeMs => {
  return ((frames / fps) * 1000) as TimeMs;
};

/**
 * Convert milliseconds to minutes:seconds format
 * Example: 125000ms -> "2:05"
 */
export const msToMinutesSeconds = (ms: TimeMs): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Convert milliseconds to hours:minutes:seconds format
 * Example: 3725000ms -> "1:02:05"
 */
export const msToHoursMinutesSeconds = (ms: TimeMs): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Convert milliseconds to timecode format (HH:MM:SS:FF)
 * @param ms - Time in milliseconds
 * @param fps - Frames per second
 * Example: msToTimecode(3725500, 30) -> "01:02:05:15"
 */
export const msToTimecode = (ms: TimeMs, fps: number): string => {
  const totalFrames = Math.floor(msToFrames(ms, fps));
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
};

/**
 * Clamp a time value between min and max
 */
export const clampTime = (time: TimeMs, min: TimeMs, max: TimeMs): TimeMs => {
  return Math.max(min, Math.min(max, time)) as TimeMs;
};

/**
 * Round time to the nearest frame
 * Useful for snapping to frame boundaries
 */
export const roundToFrame = (ms: TimeMs, fps: number): TimeMs => {
  const frames = Math.round(msToFrames(ms, fps));
  return framesToMs(frames, fps);
};

/**
 * Check if two time values are approximately equal
 * Useful for floating-point comparisons
 */
export const timeEquals = (a: TimeMs, b: TimeMs, tolerance: number = 0.1): boolean => {
  return Math.abs(a - b) < tolerance;
};
