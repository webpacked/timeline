/**
 * @timeline/core
 * 
 * A deterministic, frame-based timeline editing kernel.
 * 
 * This is the foundational layer for professional timeline editors.
 * It provides:
 * - Frame-based time representation (no floating-point drift)
 * - Immutable state management (predictable, testable)
 * - Validation before mutation (prevents invalid states)
 * - Snapshot-based undo/redo (reliable history)
 * - Pure operations (no side effects)
 * 
 * DESIGN PHILOSOPHY:
 * - Clarity over cleverness
 * - Determinism over convenience
 * - Stability over speed
 * 
 * USAGE:
 * ```typescript
 * import { TimelineEngine, createTimeline, createTrack, createClip, frame, frameRate } from '@timeline/core';
 * 
 * // Create initial state
 * const timeline = createTimeline({
 *   id: 'timeline_1',
 *   name: 'My Project',
 *   fps: frameRate(30),
 *   duration: frame(9000),
 *   tracks: [],
 * });
 * 
 * const state = createTimelineState({ timeline, assets: new Map() });
 * 
 * // Create engine
 * const engine = new TimelineEngine(state);
 * 
 * // Use the engine
 * const result = engine.addClip(trackId, clip);
 * if (!result.success) {
 *   console.error('Failed:', result.errors);
 * }
 * ```
 */

// ===== CORE TYPES =====
export type { Frame, FrameRate } from './types/frame';
export type { Asset, AssetType } from './types/asset';
export type { Clip } from './types/clip';
export type { Track, TrackType } from './types/track';
export type { Timeline } from './types/timeline';
export type { TimelineState } from './types/state';
export type { ValidationError, ValidationResult } from './types/validation';

// ===== FACTORY FUNCTIONS =====
export { frame, frameRate, isValidFrame, isValidFrameRate } from './types/frame';
export { createAsset } from './types/asset';
export { createClip, getClipDuration, getClipMediaDuration, clipContainsFrame, clipsOverlap } from './types/clip';
export { createTrack, sortTrackClips } from './types/track';
export { createTimeline } from './types/timeline';
export { createTimelineState } from './types/state';
export { validResult, invalidResult, invalidResults, combineResults } from './types/validation';

// ===== FRAME UTILITIES =====
export {
  framesToSeconds,
  secondsToFrames,
  framesToTimecode,
  framesToMinutesSeconds,
  clampFrame,
  addFrames,
  subtractFrames,
  frameDuration,
} from './utils/frame';

// ===== ID UTILITIES =====
export {
  generateId,
  generateClipId,
  generateTrackId,
  generateTimelineId,
  generateAssetId,
  resetIdCounter,
} from './utils/id';

// ===== TIMELINE ENGINE =====
export { TimelineEngine } from './engine/timeline-engine';
export type { DispatchResult } from './engine/dispatcher';

// ===== QUERY FUNCTIONS (for advanced users) =====
export {
  findClipById,
  findTrackById,
  getClipsOnTrack,
  getClipsAtFrame,
  getClipsInRange,
  getAllClips,
  getAllTracks,
  findTrackIndex,
} from './systems/queries';

// ===== ASSET REGISTRY (for advanced users) =====
export {
  registerAsset,
  getAsset,
  hasAsset,
  getAllAssets,
  unregisterAsset,
} from './systems/asset-registry';

// ===== VALIDATION (for advanced users) =====
export {
  validateClip,
  validateTrack,
  validateTimeline,
  validateNoOverlap,
} from './systems/validation';

// ===== OPERATIONS (for advanced users) =====
export {
  addClip,
  removeClip,
  moveClip,
  resizeClip,
  trimClip,
  updateClip,
  moveClipToTrack,
} from './operations/clip-operations';

export {
  addTrack,
  removeTrack,
  moveTrack,
  updateTrack,
  toggleTrackMute,
  toggleTrackLock,
} from './operations/track-operations';

export {
  setTimelineDuration,
  setTimelineName,
  updateTimelineMetadata,
} from './operations/timeline-operations';
