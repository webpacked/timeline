/**
 * ID GENERATION UTILITIES
 * 
 * Simple, deterministic ID generation for timeline entities.
 * 
 * WHY SIMPLE IDS?
 * - Easy to debug (readable IDs like "clip_1", "track_2")
 * - Deterministic for testing (can reset counter)
 * - No external dependencies (no UUID library needed)
 * 
 * USAGE:
 * ```typescript
 * const clipId = generateClipId();  // "clip_1"
 * const trackId = generateTrackId();  // "track_1"
 * 
 * // For testing, you can reset the counter
 * resetIdCounter();
 * ```
 * 
 * NOTE: In production, you might want to use UUIDs or other
 * globally unique identifiers. This simple system is sufficient
 * for Phase 1 and makes debugging easier.
 */

/**
 * Internal counter for ID generation
 * This is mutable state, but isolated to this module
 */
let idCounter = 0;

/**
 * Generate a unique ID with a given prefix
 * 
 * @param prefix - Prefix for the ID (e.g., "clip", "track")
 * @returns A unique ID string
 */
export function generateId(prefix: string): string {
  idCounter++;
  return `${prefix}_${idCounter}`;
}

/**
 * Generate a unique clip ID
 * 
 * @returns A unique clip ID (e.g., "clip_1")
 */
export function generateClipId(): string {
  return generateId('clip');
}

/**
 * Generate a unique track ID
 * 
 * @returns A unique track ID (e.g., "track_1")
 */
export function generateTrackId(): string {
  return generateId('track');
}

/**
 * Generate a unique timeline ID
 * 
 * @returns A unique timeline ID (e.g., "timeline_1")
 */
export function generateTimelineId(): string {
  return generateId('timeline');
}

/**
 * Generate a unique asset ID
 * 
 * @returns A unique asset ID (e.g., "asset_1")
 */
export function generateAssetId(): string {
  return generateId('asset');
}

/**
 * Reset the ID counter
 * 
 * This is useful for testing to ensure deterministic IDs.
 * DO NOT use this in production code.
 */
export function resetIdCounter(): void {
  idCounter = 0;
}
