/**
 * @webpacked-timeline/core - Internal API
 * 
 * This file exports internal systems, operations, and utilities.
 * 
 * PURPOSE:
 * - Used by test files to access internal functionality
 * - Used by advanced integrations that need low-level access
 * - NOT part of the public API contract
 * 
 * WARNING:
 * - These exports are NOT stable
 * - They may change without notice
 * - Breaking changes to internals are NOT considered breaking changes to the package
 * - Use at your own risk
 * 
 * RECOMMENDATION:
 * - Prefer using the public API (TimelineEngine) whenever possible
 * - Only use internals when absolutely necessary
 */

// ========================================
// RE-EXPORT PUBLIC API
// ========================================

export * from './public-api';

// ========================================
// INTERNAL SYSTEMS
// ========================================

// Validation
export {
  validateClip,
  validateTrack,
  validateTimeline,
  validateNoOverlap,
} from './systems/validation';

// Queries
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

// Asset Registry
export {
  registerAsset,
  getAsset,
  hasAsset,
  getAllAssets,
  unregisterAsset,
} from './systems/asset-registry';

// Snapping — Phase 2 (snap-index.ts replaced this)
// Linking   — Phase 4
// Grouping  — Phase 4
// Clipboard — Phase 4
// DragState — Phase 1 adapter (lives in packages/react)

// ========================================
// INTERNAL OPERATIONS
// ========================================

// Clip Operations
export {
  addClip,
  removeClip,
  moveClip,
  resizeClip,
  trimClip,
  updateClip,
  moveClipToTrack,
} from './operations/clip-operations';

// Track Operations
export {
  addTrack,
  removeTrack,
  moveTrack,
  updateTrack,
  toggleTrackMute,
  toggleTrackLock,
} from './operations/track-operations';

// Timeline Operations
export {
  setTimelineDuration,
  setTimelineName,
} from './operations/timeline-operations';

// Marker Operations — Phase 3
// Linked Operations — Phase 4

// Ripple Operations
export {
  rippleDelete,
  rippleTrim,
  insertEdit,
  rippleMove,
  insertMove,
} from './operations/ripple';

// ========================================
// INTERNAL UTILITIES
// ========================================

// ID Generation
export {
  generateId,
  generateClipId,
  generateTrackId,
  generateTimelineId,
  generateAssetId,
  resetIdCounter,
} from './utils/id';

export {
  generateLinkGroupId,
  generateGroupId,
  generateMarkerId,
} from './utils/id-phase2';

// Frame Utilities
export {
  framesToMinutesSeconds,
  clampFrame,
  addFrames,
  subtractFrames,
  frameDuration,
} from './utils/frame';

export {
  isValidFrame,
  isDropFrame,
} from './types/frame';

// Frame type alias for test backward compat (tests import `type Frame`)
export type { TimelineFrame as Frame, TimelineFrame } from './types/frame';

// Clip Utilities
export {
  getClipDuration,
  getClipMediaDuration,
  clipContainsFrame,
  clipsOverlap,
} from './types/clip';

// Track Utilities
export {
  sortTrackClips,
} from './types/track';

// Validation Utilities
export {
  validResult,
  invalidResult,
  invalidResults,
  combineResults,
} from './types/validation';

// ========================================
// INTERNAL ENGINE COMPONENTS
// ========================================

// Dispatcher & Operations
export type { DispatchResult, Transaction, OperationPrimitive, InvariantViolation, ViolationType, RejectionReason } from './types/operations';
export { dispatch } from './engine/dispatcher';
export { checkInvariants } from './validation/invariants';

// TimelineEngine — for test files
export { TimelineEngine } from './engine/timeline-engine';

