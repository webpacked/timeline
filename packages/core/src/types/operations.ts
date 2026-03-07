/**
 * OPERATION PRIMITIVES — Phase 0 compliant
 *
 * The ONLY way to express a mutation in the engine.
 * All mutations flow through: OperationPrimitive[] → Transaction → Dispatcher.
 *
 * RULE: Never add a new mutation function.
 *       Add a new type to OperationPrimitive, handle it in the Dispatcher switch,
 *       update the InvariantChecker, and update OPERATIONS.md.
 *
 * RULE: Transactions are all-or-nothing.
 *       If any primitive fails validation, the entire Transaction is rejected.
 */

import type { TimelineFrame, Timecode } from './frame';
import type { AssetId, Asset, AssetStatus } from './asset';
import type { ClipId, Clip } from './clip';
import type { TrackId, Track, TrackType } from './track';
import type { SequenceSettings, Timeline } from './timeline';
import type { TimelineState } from './state';
import type { MarkerId, Marker, BeatGrid } from './marker';
import type { Generator } from './generator';
import type { CaptionId, Caption, CaptionStyle } from './caption';
import type { Effect, EffectId } from './effect';
import type { Keyframe, KeyframeId } from './keyframe';
import type { EasingCurve } from './easing';
import type { ClipTransform } from './clip-transform';
import type { AudioProperties } from './audio-properties';
import type { Transition, TransitionAlignment } from './transition';
import type { LinkGroup, LinkGroupId } from './link-group';
import type { TrackGroup, TrackGroupId } from './track-group';

// ---------------------------------------------------------------------------
// OperationPrimitive — the complete, versioned discriminated union
// ---------------------------------------------------------------------------

export type OperationPrimitive =
  // — Clip operations —
  | { type: 'MOVE_CLIP';         clipId: ClipId; newTimelineStart: TimelineFrame; targetTrackId?: TrackId }
  | { type: 'RESIZE_CLIP';       clipId: ClipId; edge: 'start' | 'end'; newFrame: TimelineFrame }
  | { type: 'SLICE_CLIP';        clipId: ClipId; atFrame: TimelineFrame }
  | { type: 'DELETE_CLIP';       clipId: ClipId }
  | { type: 'INSERT_CLIP';       clip: Clip; trackId: TrackId }
  | { type: 'SET_MEDIA_BOUNDS';  clipId: ClipId; mediaIn: TimelineFrame; mediaOut: TimelineFrame }
  | { type: 'SET_CLIP_ENABLED';  clipId: ClipId; enabled: boolean }
  | { type: 'SET_CLIP_REVERSED'; clipId: ClipId; reversed: boolean }
  | { type: 'SET_CLIP_SPEED';    clipId: ClipId; speed: number }
  | { type: 'SET_CLIP_COLOR';    clipId: ClipId; color: string | null }
  | { type: 'SET_CLIP_NAME';     clipId: ClipId; name: string | null }
  // — Track operations —
  | { type: 'ADD_TRACK';         track: Track }
  | { type: 'DELETE_TRACK';      trackId: TrackId }
  | { type: 'REORDER_TRACK';     trackId: TrackId; newIndex: number }
  | { type: 'SET_TRACK_HEIGHT';  trackId: TrackId; height: number }
  | { type: 'SET_TRACK_NAME';    trackId: TrackId; name: string }
  // — Asset operations —
  | { type: 'REGISTER_ASSET';    asset: Asset }
  | { type: 'UNREGISTER_ASSET';  assetId: AssetId }
  | { type: 'SET_ASSET_STATUS';  assetId: AssetId; status: AssetStatus }
  // — Timeline operations —
  | { type: 'RENAME_TIMELINE';          name: string }
  | { type: 'SET_TIMELINE_DURATION';    duration: TimelineFrame }
  | { type: 'SET_TIMELINE_START_TC';    startTimecode: Timecode }
  | { type: 'SET_SEQUENCE_SETTINGS';    settings: Partial<SequenceSettings> }
  // — Phase 3: Marker operations —
  | { type: 'ADD_MARKER';    marker: Marker }
  | { type: 'MOVE_MARKER';   markerId: MarkerId; newFrame: TimelineFrame }
  | { type: 'DELETE_MARKER'; markerId: MarkerId }
  // — Phase 3: In/Out —
  | { type: 'SET_IN_POINT';  frame: TimelineFrame | null }
  | { type: 'SET_OUT_POINT'; frame: TimelineFrame | null }
  // — Phase 3: Beat grid —
  | { type: 'ADD_BEAT_GRID';    beatGrid: BeatGrid }
  | { type: 'REMOVE_BEAT_GRID' }
  // — Phase 3: Generator —
  | { type: 'INSERT_GENERATOR'; generator: Generator; trackId: TrackId; atFrame: TimelineFrame }
  // — Phase 3: Caption —
  | { type: 'ADD_CAPTION';    caption: Omit<Caption, 'style'> & { style?: CaptionStyle }; trackId: TrackId }
  | { type: 'EDIT_CAPTION';   captionId: CaptionId; trackId: TrackId; text?: string; language?: string; style?: Partial<CaptionStyle>; burnIn?: boolean; startFrame?: TimelineFrame; endFrame?: TimelineFrame }
  | { type: 'DELETE_CAPTION'; captionId: CaptionId; trackId: TrackId }
  // — Phase 4: Effect & Keyframe —
  | { type: 'ADD_EFFECT';        clipId: ClipId; effect: Effect }
  | { type: 'REMOVE_EFFECT';    clipId: ClipId; effectId: EffectId }
  | { type: 'REORDER_EFFECT';   clipId: ClipId; effectId: EffectId; newIndex: number }
  | { type: 'SET_EFFECT_ENABLED'; clipId: ClipId; effectId: EffectId; enabled: boolean }
  | { type: 'SET_EFFECT_PARAM';   clipId: ClipId; effectId: EffectId; key: string; value: number | string | boolean }
  | { type: 'ADD_KEYFRAME';     clipId: ClipId; effectId: EffectId; keyframe: Keyframe }
  | { type: 'MOVE_KEYFRAME';    clipId: ClipId; effectId: EffectId; keyframeId: KeyframeId; newFrame: TimelineFrame }
  | { type: 'DELETE_KEYFRAME';  clipId: ClipId; effectId: EffectId; keyframeId: KeyframeId }
  | { type: 'SET_KEYFRAME_EASING'; clipId: ClipId; effectId: EffectId; keyframeId: KeyframeId; easing: EasingCurve }
  // — Phase 4 Step 3: Transform, Audio, Transitions, Groups —
  | { type: 'SET_CLIP_TRANSFORM';    clipId: ClipId; transform: Partial<ClipTransform> }
  | { type: 'SET_AUDIO_PROPERTIES';  clipId: ClipId; properties: Partial<AudioProperties> }
  | { type: 'ADD_TRANSITION';        clipId: ClipId; transition: Transition }
  | { type: 'DELETE_TRANSITION';     clipId: ClipId }
  | { type: 'SET_TRANSITION_DURATION';  clipId: ClipId; durationFrames: number }
  | { type: 'SET_TRANSITION_ALIGNMENT'; clipId: ClipId; alignment: TransitionAlignment }
  | { type: 'LINK_CLIPS';            linkGroup: LinkGroup }
  | { type: 'UNLINK_CLIPS';          linkGroupId: LinkGroupId }
  | { type: 'ADD_TRACK_GROUP';       trackGroup: TrackGroup }
  | { type: 'DELETE_TRACK_GROUP';    trackGroupId: TrackGroupId }
  | { type: 'SET_TRACK_BLEND_MODE';  trackId: TrackId; blendMode: string }
  | { type: 'SET_TRACK_OPACITY';     trackId: TrackId; opacity: number };

// ---------------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------------

/**
 * Transaction — an atomic, labeled batch of OperationPrimitives.
 *
 * All primitives in a Transaction are validated before any are applied.
 * If one fails, none are applied. This is the all-or-nothing rule.
 */
export type Transaction = {
  readonly id: string;
  readonly label: string;
  readonly timestamp: number;
  readonly operations: readonly OperationPrimitive[];
};

// ---------------------------------------------------------------------------
// DispatchResult
// ---------------------------------------------------------------------------

export type RejectionReason =
  | 'OVERLAP'
  | 'LOCKED_TRACK'
  | 'ASSET_MISSING'
  | 'TYPE_MISMATCH'
  | 'OUT_OF_BOUNDS'
  | 'MEDIA_BOUNDS_INVALID'
  | 'ASSET_IN_USE'
  | 'TRACK_NOT_EMPTY'
  | 'SPEED_INVALID'
  | 'INVARIANT_VIOLATED'
  | 'NOT_FOUND'
  | 'BEAT_GRID_EXISTS'
  | 'CLIP_NOT_FOUND'
  | 'DUPLICATE_EFFECT_ID'
  | 'EFFECT_NOT_FOUND'
  | 'EFFECT_INDEX_OUT_OF_RANGE'
  | 'KEYFRAME_NOT_FOUND'
  | 'DUPLICATE_KEYFRAME_ID'
  | 'INVALID_RANGE'
  | 'TRANSITION_NOT_FOUND'
  | 'LINK_GROUP_NOT_FOUND'
  | 'TRACK_GROUP_NOT_FOUND'
  | 'DUPLICATE_LINK_GROUP_ID'
  | 'DUPLICATE_TRACK_GROUP_ID'
  | 'INVALID_OPACITY'
  | 'TRACK_NOT_FOUND';

export type DispatchResult =
  | { accepted: true;  nextState: TimelineState }
  | { accepted: false; reason: RejectionReason; message: string };

// ---------------------------------------------------------------------------
// InvariantViolation (co-located for import convenience)
// ---------------------------------------------------------------------------

export type ViolationType =
  | 'OVERLAP'
  | 'MEDIA_BOUNDS_INVALID'
  | 'ASSET_MISSING'
  | 'TRACK_TYPE_MISMATCH'
  | 'CLIP_BEYOND_TIMELINE'
  | 'TRACK_NOT_SORTED'
  | 'DURATION_MISMATCH'
  | 'SPEED_INVALID'
  | 'SCHEMA_VERSION_MISMATCH'
  | 'MARKER_OUT_OF_BOUNDS'
  | 'IN_OUT_INVALID'
  | 'BEAT_GRID_INVALID'
  | 'CAPTION_OUT_OF_BOUNDS'
  | 'CAPTION_OVERLAP'
  | 'EFFECT_NOT_FOUND'
  | 'KEYFRAME_NOT_FOUND'
  | 'KEYFRAME_ORDER_VIOLATION'
  | 'EFFECT_INDEX_OUT_OF_RANGE'
  | 'INVALID_RENDER_STAGE'
  | 'TRACK_GROUP_NOT_FOUND'
  | 'INVALID_OPACITY'
  | 'INVALID_RANGE'
  | 'LINK_GROUP_NOT_FOUND';

export type InvariantViolation = {
  readonly type: ViolationType;
  readonly entityId: string;
  readonly message: string;
};
