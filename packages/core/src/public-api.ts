/**
 * @timeline/core — Public API (Phase 0)
 *
 * This is the stable contract surface. Everything here is intentional and minimal.
 * Internal files are not exported and may change without notice.
 */

// ── Core factories ─────────────────────────────────────────────────────────
export { createTimeline }        from './types/timeline';
export { createTrack }           from './types/track';
export { createClip }            from './types/clip';
export { createAsset }           from './types/asset';
export { createTimelineState, CURRENT_SCHEMA_VERSION } from './types/state';

// ── Frame utilities ────────────────────────────────────────────────────────
export { frame, frameRate, toFrame, toTimecode, FrameRates, isDropFrame } from './types/frame';
export { framesToTimecode, framesToSeconds, secondsToFrames } from './utils/frame';
export type { TimelineFrame as Frame } from './types/frame'; // backward compat alias

// ── High-level engine class ───────────────────────────────────────────────
export { TimelineEngine }        from './engine/timeline-engine';

// ── Dispatcher (the ONLY way to mutate state) ─────────────────────────────
export { dispatch }              from './engine/dispatcher';

// ── Invariant checker (run in every test after every mutation) ────────────
export { checkInvariants }       from './validation/invariants';

// ── History ────────────────────────────────────────────────────────────────
export {
  createHistory,
  pushHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  getCurrentState,
} from './engine/history';
export type { HistoryState, HistoryEntry } from './engine/history';
export { HistoryStack } from './engine/history';
export type { CompressionPolicy, CompressibleOpType } from './types/compression';
export {
  DEFAULT_COMPRESSION_POLICY,
  NO_COMPRESSION,
} from './types/compression';
export { TransactionCompressor } from './engine/transaction-compressor';

// ── Public types ───────────────────────────────────────────────────────────

// Time types
export type { TimelineFrame, FrameRate, RationalTime, Timecode, TimeRange } from './types/frame';

// Branded IDs
export type { AssetId }   from './types/asset';
export { toAssetId }      from './types/asset';
export type { ClipId }    from './types/clip';
export { toClipId }       from './types/clip';
export type { TrackId }   from './types/track';
export { toTrackId }      from './types/track';
export type { MarkerId }  from './types/marker';
export { toMarkerId }     from './types/marker';

// Entity types
export type { Asset, AssetStatus }              from './types/asset';
export type { Clip }                            from './types/clip';
export type { Track, TrackType }                from './types/track';
export type { Timeline, SequenceSettings }      from './types/timeline';
export type { TimelineState, AssetRegistry }    from './types/state';

// Operation types
export type {
  OperationPrimitive,
  Transaction,
  DispatchResult,
  RejectionReason,
  InvariantViolation,
  ViolationType,
}                                               from './types/operations';

// ── Phase 1 exports ────────────────────────────────────────────────────────

// Snap index
export {
  buildSnapIndex,
  nearest,
  toggleSnap,
} from './snap-index';
export type {
  SnapPointType,
  SnapPoint,
  SnapIndex,
} from './snap-index';
export { SnapIndexManager } from './engine/snap-index-manager';

// Tool system
export type {
  ToolId,
  Modifiers,
  TimelinePointerEvent,
  TimelineKeyEvent,
  ProvisionalState,
  RubberBandRegion,
  ToolContext,
  ITool,
} from './tools/types';
export { toToolId } from './tools/types';

// Tool registry
export {
  createRegistry,
  activateTool as activateToolInRegistry,
  getActiveTool,
  registerTool,
  NoOpTool,
} from './tools/registry';
export type { ToolRegistry } from './tools/registry';

// Also export activateTool unaliased for direct use
export { activateTool } from './tools/registry';

// Provisional manager
export {
  createProvisionalManager,
  setProvisional,
  clearProvisional,
  resolveClip,
} from './tools/provisional';
export type { ProvisionalManager } from './tools/provisional';

// Marker search (Phase 3)
export { findMarkersByColor, findMarkersByLabel } from './engine/marker-search';

// Subtitle import (Phase 3 Step 3)
export {
  parseSRT,
  parseVTT,
  defaultCaptionStyle,
  subtitleImportToOps,
} from './engine/subtitle-import';
export type { SRTParseOptions, VTTParseOptions } from './engine/subtitle-import';

// ── Phase 4: Easing, Keyframes, Effects, Transform, Audio, Transitions, Groups ─

export type { EasingCurve } from './types/easing';
export { LINEAR_EASING, HOLD_EASING } from './types/easing';

export type { KeyframeId, Keyframe } from './types/keyframe';
export { toKeyframeId } from './types/keyframe';

export type {
  EffectId,
  EffectType,
  RenderStage,
  EffectParam,
  Effect,
} from './types/effect';
export { toEffectId, createEffect } from './types/effect';

export type { AnimatableProperty, ClipTransform } from './types/clip-transform';
export {
  createAnimatableProperty,
  DEFAULT_CLIP_TRANSFORM,
} from './types/clip-transform';

export type { ChannelRouting, AudioProperties } from './types/audio-properties';
export { DEFAULT_AUDIO_PROPERTIES } from './types/audio-properties';

export type {
  TransitionId,
  TransitionType,
  TransitionAlignment,
  TransitionParam,
  Transition,
} from './types/transition';
export { toTransitionId, createTransition } from './types/transition';

export type { TrackGroupId, TrackGroup } from './types/track-group';
export { toTrackGroupId, createTrackGroup } from './types/track-group';

export type { LinkGroupId, LinkGroup } from './types/link-group';
export { toLinkGroupId, createLinkGroup } from './types/link-group';

// Phase 2 tools (default set for React TimelineEngine)
export { SelectionTool } from './tools/selection';
export { RazorTool } from './tools/razor';
export { RippleTrimTool } from './tools/ripple-trim';
export { RollTrimTool } from './tools/roll-trim';
export { SlipTool } from './tools/slip';
export { RippleDeleteTool } from './tools/ripple-delete';
export { RippleInsertTool } from './tools/ripple-insert';
export { HandTool } from './tools/hand';

// Phase 4 Step 4: Transition and Keyframe tools (register via createRegistry / registerTool)
export { TransitionTool } from './tools/transition-tool';
export { KeyframeTool } from './tools/keyframe-tool';

// Phase 7 Step 5: Slide and Zoom tools
export { SlideTool } from './tools/slide-tool';
export { ZoomTool, createZoomTool } from './tools/zoom-tool';
export type { ZoomToolOptions } from './tools/zoom-tool';

// Phase 5 Step 1: Serialization
export {
  SerializationError,
  serializeTimeline,
  deserializeTimeline,
  remapAssetPaths,
  findOfflineAssets,
} from './engine/serializer';
export type { AssetRemapCallback, OfflineAsset } from './engine/serializer';

// Phase 5 Step 2: OTIO interchange
export { exportToOTIO } from './engine/otio-export';
export { importFromOTIO } from './engine/otio-import';
export type { OTIODocument } from './engine/otio-export';
export type { OTIOImportOptions } from './engine/otio-import';

// Phase 5 Step 3: EDL export
export { exportToEDL, frameToTimecode, reelName } from './engine/edl-export';
export type { EDLExportOptions } from './engine/edl-export';

// Phase 5 Step 4: AAF and FCP XML export
export { exportToAAF } from './engine/aaf-export';
export type { AAFExportOptions } from './engine/aaf-export';
export { exportToFCPXML, toFCPTime } from './engine/fcpxml-export';
export type { FCPXMLExportOptions } from './engine/fcpxml-export';

// Phase 5 Step 5: Project model + bins
export type {
  ProjectId,
  BinId,
  BinItem,
  Bin,
  Project,
} from './types/project';
export {
  toProjectId,
  toBinId,
  createBin,
  createProject,
} from './types/project';
export {
  addTimeline,
  removeTimeline,
  addBin,
  removeBin,
  addItemToBin,
  removeItemFromBin,
  moveItemBetweenBins,
} from './engine/project-ops';
export { serializeProject, deserializeProject } from './engine/project-serializer';

// Phase 6 Step 1: Playhead
export { PlayheadController } from './engine/playhead-controller';
export type {
  PlayheadState,
  PlayheadEvent,
  PlayheadEventType,
  PlayheadListener,
  PlayheadUnsubscribe,
  PlaybackRate,
  PlaybackQuality,
  LoopRegion,
} from './types/playhead';
export type { Clock } from './engine/clock';
export { browserClock, nodeClock, createTestClock } from './engine/clock';

// Phase 6 Step 2: Pipeline contracts
export type {
  VideoFrameRequest,
  AudioChunkRequest,
  VideoDecoder,
  AudioDecoder,
  VideoFrameResult,
  AudioChunkResult,
  CompositeLayer,
  CompositeRequest,
  CompositeResult,
  Compositor,
  ThumbnailRequest,
  ThumbnailResult,
  ThumbnailProvider,
  PipelineConfig,
} from './types/pipeline';
export {
  resolveFrame,
  getClipsAtFrame,
  mediaFrameForClip,
  findNextClipBoundary,
  findPrevClipBoundary,
  findNextMarker,
  findPrevMarker,
  findClipById,
} from './engine/frame-resolver';
export { IntervalTree } from './engine/interval-tree';
export type { Interval } from './engine/interval-tree';
export { TrackIndex } from './engine/track-index';
export type { ClipEntry } from './engine/track-index';
export { PlaybackEngine } from './engine/playback-engine';
export { getVisibleClips, getVisibleFrameRange } from './engine/virtual-window';
export type { VirtualWindow, VirtualClipEntry } from './engine/virtual-window';
export { diffStates, EMPTY_STATE_CHANGE } from './types/state-change';
export type { StateChange } from './types/state-change';

// Phase 7 Step 4: Worker contracts, thumbnail cache/queue
export type {
  WaveformRequest,
  WaveformPeak,
  WaveformResult,
  WaveformWorkerMessage,
  WaveformWorkerResponse,
  ThumbnailPriority,
  ThumbnailQueueEntry,
  ThumbnailWorkerMessage,
  ThumbnailWorkerResponse,
} from './types/worker-contracts';
export { ThumbnailCache } from './engine/thumbnail-cache';
export { ThumbnailQueue } from './engine/thumbnail-queue';

// Phase 6 Step 4: Keyboard (J/K/L jog-shuttle)
export type {
  TimelineKeyAction,
  KeyBinding,
  KeyboardHandlerOptions,
} from './types/keyboard';
export { DEFAULT_KEY_BINDINGS } from './types/keyboard';
export { KeyboardHandler } from './engine/keyboard-handler';

