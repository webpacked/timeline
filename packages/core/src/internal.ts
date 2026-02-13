/**
 * @timeline/core - Internal API
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

// Snapping
export type { SnapTarget, SnapResult } from './systems/snapping';
export {
  findSnapTargets,
  calculateSnap,
  calculateSnapExcluding,
  findSnapTargetsForTrack,
} from './systems/snapping';

// Linking
export {
  createLinkGroup,
  breakLinkGroup,
  getLinkedClips,
  isClipLinked,
  getLinkGroup,
  addClipToLinkGroup,
  removeClipFromLinkGroup,
} from './systems/linking';

// Grouping
export {
  createGroup,
  ungroupClips,
  getGroupClips,
  isClipGrouped,
  getGroup,
  addClipToGroup,
  removeClipFromGroup,
  renameGroup,
  getChildGroups,
} from './systems/grouping';

// Clipboard
export type { ClipboardData } from './systems/clipboard';
export {
  copyClips,
  cutClips,
  pasteClips,
  duplicateClips,
} from './systems/clipboard';

// Drag State
export type { DragState } from './systems/drag-state';
export {
  calculateDragPreview,
  calculateResizeDragPreview,
} from './systems/drag-state';

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
  updateTimelineMetadata,
} from './operations/timeline-operations';

// Marker Operations
export {
  addTimelineMarker,
  addClipMarker,
  addRegionMarker,
  removeMarker,
  removeClipMarkers,
  setWorkArea,
  clearWorkArea,
  updateTimelineMarker,
  updateRegionMarker,
} from './operations/marker-operations';

// Linked Operations
export {
  moveLinkedClips,
  deleteLinkedClips,
  offsetLinkedClips,
} from './operations/linked-operations';

// Ripple Operations
export {
  rippleDelete,
  rippleTrim,
  insertEdit,
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
  isValidFrameRate,
} from './types/frame';

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

// Transactions
export type { Operation, TransactionContext, TransactionResult } from './engine/transactions';
export {
  beginTransaction,
  applyOperation,
  commitTransaction,
  rollbackTransaction,
  getOperationCount,
} from './engine/transactions';

// Dispatcher
export type { DispatchResult } from './engine/dispatcher';
