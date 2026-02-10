import type { ID } from '../types/common';

/**
 * ID Generation Utilities
 * 
 * These functions generate unique identifiers for timeline entities.
 * 
 * WHY CUSTOM IDS?
 * - Predictable format for debugging
 * - Type-prefixed for clarity (clip_123, track_456)
 * - No external dependencies (no UUID library needed)
 * 
 * PRODUCTION NOTE:
 * For production use, you might want to use a more robust ID generation
 * strategy like UUIDs or nanoid. This implementation is simple and works
 * well for learning and prototyping.
 */

let idCounter = 0;

/**
 * Generate a unique ID with an optional prefix
 * Example: generateId('clip') -> 'clip_1'
 */
export const generateId = (prefix: string = 'entity'): ID => {
  idCounter++;
  return `${prefix}_${idCounter}`;
};

/**
 * Reset the ID counter (useful for testing)
 */
export const resetIdCounter = (): void => {
  idCounter = 0;
};

/**
 * Generate a clip ID
 */
export const generateClipId = (): ID => {
  return generateId('clip');
};

/**
 * Generate a track ID
 */
export const generateTrackId = (): ID => {
  return generateId('track');
};

/**
 * Generate a timeline ID
 */
export const generateTimelineId = (): ID => {
  return generateId('timeline');
};

/**
 * Generate a marker ID
 */
export const generateMarkerId = (): ID => {
  return generateId('marker');
};
