/**
 * FRAME UTILITIES
 * 
 * Pure functions for working with frame-based time values.
 * 
 * These utilities handle:
 * - Converting between frames and seconds
 * - Formatting frames as timecode (HH:MM:SS:FF)
 * - Frame arithmetic (clamping, rounding)
 * 
 * CRITICAL RULES:
 * - All conversions must quantize to whole frames
 * - No floating-point frame values allowed
 * - Always round/floor/ceil explicitly
 * 
 * USAGE:
 * ```typescript
 * const fps = frameRate(30);
 * const frames = secondsToFrames(5.5, fps);  // 165 frames
 * const seconds = framesToSeconds(frames, fps);  // 5.5 seconds
 * const timecode = framesToTimecode(frames, fps);  // "00:00:05:15"
 * ```
 */

import type { Frame, FrameRate } from '../types/frame';
import { frame } from '../types/frame';

/**
 * Convert frames to seconds
 * 
 * @param frames - Frame number
 * @param fps - Frames per second
 * @returns Time in seconds (may be fractional)
 */
export function framesToSeconds(frames: Frame, fps: FrameRate): number {
  return frames / fps;
}

/**
 * Convert seconds to frames
 * 
 * IMPORTANT: This rounds to the nearest frame.
 * If you need different rounding behavior, use Math.floor or Math.ceil explicitly.
 * 
 * @param seconds - Time in seconds
 * @param fps - Frames per second
 * @returns Frame number (rounded to nearest frame)
 */
export function secondsToFrames(seconds: number, fps: FrameRate): Frame {
  return frame(seconds * fps);
}

/**
 * Convert frames to timecode format (HH:MM:SS:FF)
 * 
 * Example: 3825 frames at 30fps = "00:02:07:15"
 * 
 * @param frames - Frame number
 * @param fps - Frames per second
 * @returns Timecode string
 */
export function framesToTimecode(frames: Frame, fps: FrameRate): string {
  const totalFrames = frames;
  const framesPart = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const secondsPart = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutesPart = totalMinutes % 60;
  const hoursPart = Math.floor(totalMinutes / 60);
  
  return `${pad(hoursPart)}:${pad(minutesPart)}:${pad(secondsPart)}:${pad(framesPart)}`;
}

/**
 * Convert frames to simple MM:SS format
 * 
 * Example: 3825 frames at 30fps = "02:07"
 * 
 * @param frames - Frame number
 * @param fps - Frames per second
 * @returns Time string in MM:SS format
 */
export function framesToMinutesSeconds(frames: Frame, fps: FrameRate): string {
  const totalSeconds = Math.floor(frames / fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  return `${minutes}:${pad(seconds)}`;
}

/**
 * Clamp a frame value between min and max
 * 
 * @param value - Frame to clamp
 * @param min - Minimum frame (inclusive)
 * @param max - Maximum frame (inclusive)
 * @returns Clamped frame value
 */
export function clampFrame(value: Frame, min: Frame, max: Frame): Frame {
  return frame(Math.max(min, Math.min(max, value)));
}

/**
 * Add two frame values
 * 
 * @param a - First frame
 * @param b - Second frame
 * @returns Sum of frames
 */
export function addFrames(a: Frame, b: Frame): Frame {
  return frame(a + b);
}

/**
 * Subtract two frame values
 * 
 * @param a - First frame
 * @param b - Second frame (subtracted from a)
 * @returns Difference of frames (clamped to 0 if negative)
 */
export function subtractFrames(a: Frame, b: Frame): Frame {
  return frame(Math.max(0, a - b));
}

/**
 * Calculate duration between two frames
 * 
 * @param start - Start frame
 * @param end - End frame
 * @returns Duration in frames (end - start)
 */
export function frameDuration(start: Frame, end: Frame): Frame {
  return frame(end - start);
}

// Helper function to pad numbers with leading zeros
function pad(num: number, width: number = 2): string {
  return num.toString().padStart(width, '0');
}
