/**
 * Common Types
 *
 * These are the foundational types used throughout the timeline core.
 * They establish conventions for time representation, IDs, and basic structures.
 */

/**
 * TimeMs - Time in milliseconds
 *
 * WHY MILLISECONDS?
 * - Precise enough for video (1ms = sub-frame precision at 60fps)
 * - Works for audio, animation, and general timelines
 * - Easy to convert to/from frames, seconds, or beats
 * - JavaScript's native time unit
 *
 * This is a branded type to prevent accidentally mixing regular numbers with time values.
 */
export type TimeMs = number & { readonly __brand: "TimeMs" };

/**
 * Create a TimeMs value from a number
 * This is the only way to create TimeMs values, ensuring type safety
 */
export const timeMs = (value: number): TimeMs => value as TimeMs;

/**
 * ID - Unique identifier for entities
 *
 * WHY STRING IDS?
 * - Easy to serialize/deserialize (JSON-friendly)
 * - Decouples entities (no circular references)
 * - Framework-agnostic (works everywhere)
 * - Human-readable for debugging
 */
export type ID = string;

/**
 * Bounds - Represents a time range
 * Used for clips, selections, and visible viewport ranges
 */
export interface Bounds {
  start: TimeMs;
  end: TimeMs;
}

/**
 * Point - Represents a 2D coordinate
 * Used for viewport calculations and conversions
 */
export interface Point {
  x: number;
  y: number;
}
