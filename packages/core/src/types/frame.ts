/**
 * FRAME-BASED TIME REPRESENTATION
 * 
 * This file defines the foundational time system for the entire timeline engine.
 * 
 * WHY FRAMES INSTEAD OF MILLISECONDS?
 * - Frames are discrete, integer values (no floating-point drift)
 * - Frames are deterministic (same input always produces same output)
 * - Frames match how video editors actually work (frame-accurate editing)
 * - Frames prevent rounding errors that accumulate over time
 * 
 * CRITICAL RULE:
 * All time values in the timeline state MUST be stored as frames.
 * Never store time as seconds or milliseconds in state.
 * 
 * USAGE:
 * ```typescript
 * const fps = 30 as FrameRate;
 * const frame = 150 as Frame;  // 5 seconds at 30fps
 * ```
 */

/**
 * Frame - A discrete point in time, measured in frames
 * 
 * This is a "branded type" - it's just a number at runtime,
 * but TypeScript treats it as a distinct type to prevent mixing
 * frames with regular numbers accidentally.
 * 
 * INVARIANT: Frame values must be non-negative integers
 */
export type Frame = number & { readonly __brand: 'Frame' };

/**
 * FrameRate - Frames per second (FPS)
 * 
 * Common values: 24, 25, 30, 60
 * 
 * INVARIANT: FrameRate must be a positive number
 */
export type FrameRate = number & { readonly __brand: 'FrameRate' };

/**
 * Create a Frame value from a number
 * 
 * This function validates and rounds the input to ensure it's a valid frame number.
 * 
 * @param value - The frame number (will be rounded to nearest integer)
 * @returns A valid Frame value
 * @throws Error if value is negative
 */
export function frame(value: number): Frame {
  const rounded = Math.round(value);
  
  if (rounded < 0) {
    throw new Error(`Frame value must be non-negative, got: ${value}`);
  }
  
  return rounded as Frame;
}

/**
 * Create a FrameRate value from a number
 * 
 * @param value - The frames per second
 * @returns A valid FrameRate value
 * @throws Error if value is not positive
 */
export function frameRate(value: number): FrameRate {
  if (value <= 0) {
    throw new Error(`FrameRate must be positive, got: ${value}`);
  }
  
  return value as FrameRate;
}

/**
 * Check if a value is a valid frame number
 * 
 * @param value - The value to check
 * @returns true if the value is a non-negative integer
 */
export function isValidFrame(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Check if a value is a valid frame rate
 * 
 * @param value - The value to check
 * @returns true if the value is positive
 */
export function isValidFrameRate(value: number): boolean {
  return value > 0;
}
