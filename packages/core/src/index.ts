/**
 * @timeline/core
 * 
 * A framework-agnostic timeline editor core library.
 * 
 * This library provides the data structures and operations for building
 * professional timeline editors (like video editors, audio DAWs, animation tools).
 * 
 * KEY PRINCIPLES:
 * - Zero UI dependencies (no DOM, no React, no frameworks)
 * - Immutable state (all operations return new objects)
 * - Pure functions (no side effects)
 * - Type-safe (full TypeScript support)
 * 
 * USAGE:
 * ```ts
 * import { createTimeline, createTrack, createClip, addClip } from '@timeline/core';
 * 
 * const timeline = createTimeline({
 *   id: 'timeline_1',
 *   name: 'My Project',
 *   duration: timeMs(60000), // 60 seconds
 * });
 * ```
 */

// ===== TYPES =====
export type { TimeMs, ID, Bounds, Point } from './types/common';
export type { Timeline } from './types/timeline';
export type { Track } from './types/track';
export type { Clip, ClipType } from './types/clip';
export type { Marker } from './types/marker';
export type { PlayheadState } from './types/playhead';
export type { SelectionState } from './types/selection';
export type { ViewportState } from './types/viewport';

// ===== FACTORY FUNCTIONS =====
export { timeMs } from './types/common';
export { createTimeline } from './types/timeline';
export { createTrack } from './types/track';
export { createClip, getClipEnd, getClipBounds } from './types/clip';
export { createMarker } from './types/marker';
export { createPlayheadState } from './types/playhead';
export { createSelectionState, isClipSelected, isTrackSelected, hasSelection } from './types/selection';
export { 
  createViewportState, 
  getVisibleDuration, 
  getVisibleEnd, 
  isTimeVisible,
  timeToPixels,
  pixelsToTime,
} from './types/viewport';

// ===== CLIP OPERATIONS =====
export {
  moveClip,
  resizeClip,
  resizeClipLeft,
  resizeClipRight,
  splitClip,
  trimClip,
  moveClipToTrack,
  offsetClip,
  clipsOverlap,
  clipContainsTime,
  getClipsInRange,
  sortClipsByTime,
} from './operations/clip-operations';

// ===== TRACK OPERATIONS =====
export {
  addClipToTrack,
  removeClipFromTrack,
  updateClipInTrack,
  getClipFromTrack,
  toggleTrackMute,
  toggleTrackLock,
  toggleTrackVisibility,
  setTrackHeight,
  renameTrack,
  clearTrack,
} from './operations/track-operations';

// ===== TIMELINE OPERATIONS =====
export {
  addTrack,
  removeTrack,
  updateTrack,
  getTrack,
  moveTrack,
  addClip,
  removeClip,
  updateClip,
  getClip,
  getAllClips,
  addMarker,
  removeMarker,
  updateMarker,
  getMarker,
  setTimelineDuration,
  renameTimeline,
} from './operations/timeline-operations';

// ===== SELECTION OPERATIONS =====
export {
  selectClip,
  addClipToSelection,
  removeClipFromSelection,
  toggleClipSelection,
  selectClips,
  selectTrack,
  addTrackToSelection,
  removeTrackFromSelection,
  toggleTrackSelection,
  clearSelection,
  clearClipSelection,
  clearTrackSelection,
  setTimeRangeSelection,
  clearTimeRangeSelection,
  selectAllClipsInTrack,
  selectAllClipsInTracks,
  getSelectedClips,
  getSelectedTracks,
} from './operations/selection-operations';

// ===== SNAPPING =====
export type { SnapTarget, SnapResult, SnapOptions } from './calculations/snapping';
export {
  collectSnapTargets,
  findNearestSnapTarget,
  snapTime,
  snapClipStart,
  snapClipEnd,
} from './calculations/snapping';

// ===== TIME UTILITIES =====
export {
  msToSeconds,
  secondsToMs,
  msToFrames,
  framesToMs,
  msToMinutesSeconds,
  msToHoursMinutesSeconds,
  msToTimecode,
  clampTime,
  roundToFrame,
  timeEquals,
} from './utils/time';

// ===== ID UTILITIES =====
export {
  generateId,
  resetIdCounter,
  generateClipId,
  generateTrackId,
  generateTimelineId,
  generateMarkerId,
} from './utils/id';

// ===== VALIDATION =====
export {
  validateTime,
  validateDuration,
  validateClip,
  validateTimeline,
  validateZoom,
} from './utils/validation';
