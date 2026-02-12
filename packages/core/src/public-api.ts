/**
 * @timeline/core - Public API
 * 
 * This is the stable, public API surface for the timeline editing kernel.
 * 
 * PHILOSOPHY:
 * - Public API = Contract (stable, minimal, intentional)
 * - Internal code = Implementation (free to refactor)
 * 
 * This file exports ONLY what consumers need to use the timeline engine.
 * Internal systems, operations, and utilities are NOT exported here.
 */

// ========================================
// CORE ENGINE
// ========================================

/**
 * The main timeline engine providing high-level editing operations.
 * 
 * This is the primary interface for interacting with the timeline.
 * All editing operations go through this engine.
 */
export { TimelineEngine } from './engine/timeline-engine';

// ========================================
// FACTORY FUNCTIONS
// ========================================

/**
 * Factory functions for creating core timeline entities.
 * These are the primary way to construct timeline objects.
 */
export { createTimeline } from './types/timeline';
export { createTrack } from './types/track';
export { createClip } from './types/clip';
export { createAsset } from './types/asset';
export { createTimelineState } from './types/state';

// ========================================
// FRAME UTILITIES
// ========================================

/**
 * Frame-based time utilities.
 * 
 * The timeline uses frame-based time for deterministic editing.
 * These utilities help convert between frames and other time formats.
 */
export { 
  frame, 
  frameRate,
} from './types/frame';

export { 
  framesToTimecode,
  framesToSeconds,
  secondsToFrames,
} from './utils/frame';

// ========================================
// PUBLIC TYPES
// ========================================

/**
 * Core type definitions.
 * 
 * These types define the shape of timeline data structures.
 * Consumers use these for type safety when working with the engine.
 */

// Frame types
export type { Frame, FrameRate } from './types/frame';

// Core entity types
export type { Timeline } from './types/timeline';
export type { Track, TrackType } from './types/track';
export type { Clip } from './types/clip';
export type { Asset, AssetType } from './types/asset';
export type { TimelineState } from './types/state';

// Validation types (returned by engine methods)
export type { ValidationResult, ValidationError } from './types/validation';

// Phase 2: Marker types
export type { 
  TimelineMarker,
  ClipMarker,
  RegionMarker,
  WorkArea,
  Marker 
} from './types/marker';

// Phase 2: Linking types
export type { LinkGroup } from './types/linking';

// Phase 2: Grouping types
export type { Group } from './types/grouping';

// ========================================
// NOTES FOR CONSUMERS
// ========================================

/**
 * USAGE PATTERN:
 * 
 * ```typescript
 * import { 
 *   TimelineEngine,
 *   createTimeline,
 *   createTrack,
 *   createClip,
 *   createAsset,
 *   frame,
 *   frameRate
 * } from '@timeline/core';
 * 
 * // Create timeline
 * const timeline = createTimeline({
 *   id: 'timeline-1',
 *   name: 'My Timeline',
 *   fps: frameRate(30),
 *   duration: frame(3000),
 *   tracks: []
 * });
 * 
 * // Create engine
 * const engine = new TimelineEngine(createTimelineState({ timeline }));
 * 
 * // Use high-level operations
 * engine.addTrack(createTrack({ ... }));
 * engine.addClip(trackId, createClip({ ... }));
 * engine.moveClip(clipId, frame(100));
 * 
 * // Access state
 * const state = engine.getState();
 * ```
 * 
 * WHAT'S NOT EXPORTED:
 * - Internal operations (addClip, moveClip, etc. - use TimelineEngine methods)
 * - Internal systems (validation, queries, snapping, linking, grouping)
 * - Internal utilities (ID generation, low-level helpers)
 * - Transaction primitives (use TimelineEngine transaction methods)
 * 
 * WHY:
 * - Keeps API surface small and stable
 * - Allows internal refactoring without breaking changes
 * - Encourages use of high-level TimelineEngine API
 * - Reduces cognitive overhead for consumers
 */
