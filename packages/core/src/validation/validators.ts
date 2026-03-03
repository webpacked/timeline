/**
 * PER-PRIMITIVE VALIDATORS — Phase 0 compliant
 *
 * Runs BEFORE applying an operation. Each function checks whether the
 * operation can legally be applied to the current state.
 *
 * Returns null if valid, or a { reason, message } rejection if not.
 * The Dispatcher calls these in order and stops at the first failure.
 *
 * RULE: No mutation here. These are pure read-only checks.
 */

import type { TimelineState } from '../types/state';
import type { OperationPrimitive, RejectionReason } from '../types/operations';
import type { Clip } from '../types/clip';
import type { Effect, EffectId } from '../types/effect';

type Rejection = { reason: RejectionReason; message: string };

// ---------------------------------------------------------------------------
// validateOperation — dispatcher interface
// ---------------------------------------------------------------------------

export function validateOperation(
  state: TimelineState,
  op: OperationPrimitive,
): Rejection | null {
  switch (op.type) {

    case 'MOVE_CLIP':        return validateMoveClip(state, op);
    case 'RESIZE_CLIP':      return validateResizeClip(state, op);
    case 'SLICE_CLIP':       return validateSliceClip(state, op);
    case 'DELETE_CLIP':      return validateDeleteClip(state, op);
    case 'INSERT_CLIP':      return validateInsertClip(state, op);
    case 'SET_MEDIA_BOUNDS': return validateSetMediaBounds(state, op);
    case 'SET_CLIP_SPEED':   return validateSetClipSpeed(state, op);

    case 'ADD_TRACK':        return validateAddTrack(state, op);
    case 'DELETE_TRACK':     return validateDeleteTrack(state, op);
    case 'UNREGISTER_ASSET': return validateUnregisterAsset(state, op);

    case 'ADD_MARKER':       return validateAddMarker(state, op);
    case 'MOVE_MARKER':      return validateMoveMarker(state, op);
    case 'DELETE_MARKER':    return validateDeleteMarker(state, op);
    case 'SET_IN_POINT':     return validateSetInPoint(state, op);
    case 'SET_OUT_POINT':    return validateSetOutPoint(state, op);
    case 'ADD_BEAT_GRID':    return validateAddBeatGrid(state, op);
    case 'REMOVE_BEAT_GRID': return validateRemoveBeatGrid(state, op);
    case 'INSERT_GENERATOR': return validateInsertGenerator(state, op);
    case 'ADD_CAPTION':      return validateAddCaption(state, op);
    case 'EDIT_CAPTION':     return validateEditCaption(state, op);
    case 'DELETE_CAPTION':   return validateDeleteCaption(state, op);

    case 'ADD_EFFECT':         return validateAddEffect(state, op);
    case 'REMOVE_EFFECT':      return validateRemoveEffect(state, op);
    case 'REORDER_EFFECT':     return validateReorderEffect(state, op);
    case 'SET_EFFECT_ENABLED': return validateSetEffectEnabled(state, op);
    case 'SET_EFFECT_PARAM':   return validateSetEffectParam(state, op);
    case 'ADD_KEYFRAME':       return validateAddKeyframe(state, op);
    case 'MOVE_KEYFRAME':      return validateMoveKeyframe(state, op);
    case 'DELETE_KEYFRAME':    return validateDeleteKeyframe(state, op);
    case 'SET_KEYFRAME_EASING': return validateSetKeyframeEasing(state, op);

    case 'SET_CLIP_TRANSFORM':     return validateSetClipTransform(state, op);
    case 'SET_AUDIO_PROPERTIES':   return validateSetAudioProperties(state, op);
    case 'ADD_TRANSITION':         return validateAddTransition(state, op);
    case 'DELETE_TRANSITION':      return validateDeleteTransition(state, op);
    case 'SET_TRANSITION_DURATION':  return validateSetTransitionDuration(state, op);
    case 'SET_TRANSITION_ALIGNMENT':  return validateSetTransitionAlignment(state, op);
    case 'LINK_CLIPS':             return validateLinkClips(state, op);
    case 'UNLINK_CLIPS':           return validateUnlinkClips(state, op);
    case 'ADD_TRACK_GROUP':        return validateAddTrackGroup(state, op);
    case 'DELETE_TRACK_GROUP':     return validateDeleteTrackGroup(state, op);
    case 'SET_TRACK_BLEND_MODE':   return validateSetTrackBlendMode(state, op);
    case 'SET_TRACK_OPACITY':      return validateSetTrackOpacity(state, op);

    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Clip validators
// ---------------------------------------------------------------------------

function validateMoveClip(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'MOVE_CLIP' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'ASSET_MISSING', message: `Clip '${op.clipId}' not found.` };

  const targetTrackId = op.targetTrackId ?? clip.trackId;
  const track = state.timeline.tracks.find((t) => t.id === targetTrackId);
  if (!track) return { reason: 'OUT_OF_BOUNDS', message: `Track '${targetTrackId}' not found.` };
  if (track.locked) return { reason: 'LOCKED_TRACK', message: `Track '${targetTrackId}' is locked.` };

  const duration = clip.timelineEnd - clip.timelineStart;
  const newEnd = op.newTimelineStart + duration;

  if (op.newTimelineStart < 0 || newEnd > state.timeline.duration) {
    return { reason: 'OUT_OF_BOUNDS', message: `MOVE_CLIP would place clip '${op.clipId}' outside timeline bounds.` };
  }

  // Overlap check against target track
  for (const existing of track.clips) {
    if (existing.id === op.clipId) continue; // skip self
    const overlaps = op.newTimelineStart < existing.timelineEnd && newEnd > existing.timelineStart;
    if (overlaps) {
      return { reason: 'OVERLAP', message: `Clip '${op.clipId}' would overlap '${existing.id}' on track '${targetTrackId}'.` };
    }
  }
  return null;
}

function validateResizeClip(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'RESIZE_CLIP' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'ASSET_MISSING', message: `Clip '${op.clipId}' not found.` };
  if (op.edge === 'start' && op.newFrame >= clip.timelineEnd) {
    return { reason: 'OUT_OF_BOUNDS', message: `RESIZE_CLIP start edge must be < timelineEnd.` };
  }
  if (op.edge === 'end' && op.newFrame <= clip.timelineStart) {
    return { reason: 'OUT_OF_BOUNDS', message: `RESIZE_CLIP end edge must be > timelineStart.` };
  }
  return null;
}

function validateSliceClip(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SLICE_CLIP' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'ASSET_MISSING', message: `Clip '${op.clipId}' not found.` };
  if (op.atFrame <= clip.timelineStart || op.atFrame >= clip.timelineEnd) {
    return { reason: 'OUT_OF_BOUNDS', message: `SLICE_CLIP atFrame must be strictly inside the clip bounds.` };
  }
  return null;
}

function validateDeleteClip(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'DELETE_CLIP' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'ASSET_MISSING', message: `Clip '${op.clipId}' not found.` };
  const track = state.timeline.tracks.find((t) => t.id === clip.trackId);
  if (track?.locked) return { reason: 'LOCKED_TRACK', message: `Track '${clip.trackId}' is locked.` };
  return null;
}

function validateInsertClip(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'INSERT_CLIP' }>,
): Rejection | null {
  const track = state.timeline.tracks.find((t) => t.id === op.trackId);
  if (!track) return { reason: 'OUT_OF_BOUNDS', message: `Track '${op.trackId}' not found.` };
  if (track.locked) return { reason: 'LOCKED_TRACK', message: `Track '${op.trackId}' is locked.` };

  const asset = state.assetRegistry.get(op.clip.assetId);
  if (!asset) return { reason: 'ASSET_MISSING', message: `Asset '${op.clip.assetId}' not in registry.` };
  if (asset.mediaType !== track.type) return { reason: 'TYPE_MISMATCH', message: `Asset mediaType '${asset.mediaType}' ≠ track type '${track.type}'.` };

  for (const existing of track.clips) {
    const overlaps = op.clip.timelineStart < existing.timelineEnd && op.clip.timelineEnd > existing.timelineStart;
    if (overlaps) {
      return { reason: 'OVERLAP', message: `INSERT_CLIP would overlap '${existing.id}'.` };
    }
  }
  return null;
}

function validateSetMediaBounds(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SET_MEDIA_BOUNDS' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'ASSET_MISSING', message: `Clip '${op.clipId}' not found.` };
  const asset = state.assetRegistry.get(clip.assetId);
  if (!asset) return { reason: 'ASSET_MISSING', message: `Asset '${clip.assetId}' not found.` };
  if (op.mediaIn < 0) return { reason: 'MEDIA_BOUNDS_INVALID', message: `mediaIn must be >= 0.` };
  if (op.mediaOut > asset.intrinsicDuration) {
    return { reason: 'MEDIA_BOUNDS_INVALID', message: `mediaOut (${op.mediaOut}) exceeds asset intrinsicDuration (${asset.intrinsicDuration}).` };
  }
  return null;
}

function validateSetClipSpeed(
  _state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SET_CLIP_SPEED' }>,
): Rejection | null {
  if (op.speed <= 0) return { reason: 'SPEED_INVALID', message: `speed must be > 0, got ${op.speed}.` };
  return null;
}

// ---------------------------------------------------------------------------
// Track validators
// ---------------------------------------------------------------------------

function validateAddTrack(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'ADD_TRACK' }>,
): Rejection | null {
  if (state.timeline.tracks.some((t) => t.id === op.track.id)) {
    return { reason: 'OVERLAP', message: `Track '${op.track.id}' already exists.` };
  }
  return null;
}

function validateDeleteTrack(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'DELETE_TRACK' }>,
): Rejection | null {
  const track = state.timeline.tracks.find((t) => t.id === op.trackId);
  if (!track) return { reason: 'OUT_OF_BOUNDS', message: `Track '${op.trackId}' not found.` };
  if (track.clips.length > 0) return { reason: 'TRACK_NOT_EMPTY', message: `Cannot delete track '${op.trackId}': it has ${track.clips.length} clips. Delete all clips first.` };
  return null;
}

// ---------------------------------------------------------------------------
// Asset validators
// ---------------------------------------------------------------------------

function validateUnregisterAsset(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'UNREGISTER_ASSET' }>,
): Rejection | null {
  for (const track of state.timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.assetId === op.assetId) {
        return { reason: 'ASSET_IN_USE', message: `Asset '${op.assetId}' is referenced by clip '${clip.id}'.` };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Phase 3: Marker validators
// ---------------------------------------------------------------------------

function validateAddMarker(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'ADD_MARKER' }>,
): Rejection | null {
  const { marker } = op;
  if (state.timeline.markers.some((m) => m.id === marker.id)) {
    return { reason: 'OUT_OF_BOUNDS', message: `Marker '${marker.id}' already exists.` };
  }
  if (marker.clipId != null) {
    const clip = findClip(state, marker.clipId);
    if (!clip) {
      return { reason: 'NOT_FOUND', message: `Clip '${marker.clipId}' not found.` };
    }
  }
  const dur = state.timeline.duration;
  if (marker.type === 'point') {
    if (marker.frame < 0 || marker.frame > dur) {
      return { reason: 'OUT_OF_BOUNDS', message: `Point marker frame (${marker.frame}) must be in [0, ${dur}].` };
    }
  } else {
    if (marker.frameStart >= marker.frameEnd) {
      return { reason: 'OUT_OF_BOUNDS', message: `Range marker frameStart must be < frameEnd.` };
    }
    if (marker.frameEnd > dur) {
      return { reason: 'OUT_OF_BOUNDS', message: `Range marker frameEnd (${marker.frameEnd}) exceeds timeline duration (${dur}).` };
    }
  }
  return null;
}

function validateMoveMarker(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'MOVE_MARKER' }>,
): Rejection | null {
  const marker = findMarker(state, op.markerId);
  if (!marker) return { reason: 'NOT_FOUND', message: `Marker '${op.markerId}' not found.` };
  const dur = state.timeline.duration;
  if (marker.type === 'point') {
    if (op.newFrame < 0 || op.newFrame > dur) {
      return { reason: 'OUT_OF_BOUNDS', message: `newFrame (${op.newFrame}) must be in [0, ${dur}].` };
    }
  } else {
    const duration = marker.frameEnd - marker.frameStart;
    const newEnd = op.newFrame + duration;
    if (op.newFrame < 0 || newEnd > dur) {
      return { reason: 'OUT_OF_BOUNDS', message: `MOVE_MARKER would place range marker outside timeline.` };
    }
  }
  return null;
}

function validateDeleteMarker(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'DELETE_MARKER' }>,
): Rejection | null {
  if (!findMarker(state, op.markerId)) {
    return { reason: 'NOT_FOUND', message: `Marker '${op.markerId}' not found.` };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Phase 3: In/Out validators
// ---------------------------------------------------------------------------

function validateSetInPoint(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SET_IN_POINT' }>,
): Rejection | null {
  if (op.frame === null) return null;
  if (op.frame < 0) return { reason: 'OUT_OF_BOUNDS', message: `In point frame must be >= 0.` };
  const out = state.timeline.outPoint;
  if (out !== null && op.frame >= out) {
    return { reason: 'OUT_OF_BOUNDS', message: `In point must be < out point (${out}).` };
  }
  return null;
}

function validateSetOutPoint(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SET_OUT_POINT' }>,
): Rejection | null {
  if (op.frame === null) return null;
  if (op.frame < 0) return { reason: 'OUT_OF_BOUNDS', message: `Out point frame must be >= 0.` };
  const inPt = state.timeline.inPoint;
  if (inPt !== null && op.frame <= inPt) {
    return { reason: 'OUT_OF_BOUNDS', message: `Out point must be > in point (${inPt}).` };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Phase 3: Beat grid validators
// ---------------------------------------------------------------------------

function validateAddBeatGrid(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'ADD_BEAT_GRID' }>,
): Rejection | null {
  if (state.timeline.beatGrid !== null) {
    return { reason: 'BEAT_GRID_EXISTS', message: `Timeline already has a beat grid.` };
  }
  const { beatGrid } = op;
  if (beatGrid.bpm <= 0) return { reason: 'OUT_OF_BOUNDS', message: `Beat grid bpm must be > 0.` };
  if (beatGrid.timeSignature[0] <= 0 || beatGrid.timeSignature[1] <= 0) {
    return { reason: 'OUT_OF_BOUNDS', message: `Beat grid timeSignature must be positive.` };
  }
  return null;
}

function validateRemoveBeatGrid(
  _state: TimelineState,
  _op: Extract<OperationPrimitive, { type: 'REMOVE_BEAT_GRID' }>,
): Rejection | null {
  return null;
}

// ---------------------------------------------------------------------------
// Phase 3: Generator validator
// ---------------------------------------------------------------------------

function validateInsertGenerator(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'INSERT_GENERATOR' }>,
): Rejection | null {
  const track = state.timeline.tracks.find((t) => t.id === op.trackId);
  if (!track) return { reason: 'OUT_OF_BOUNDS', message: `Track '${op.trackId}' not found.` };
  if (track.locked) return { reason: 'LOCKED_TRACK', message: `Track '${op.trackId}' is locked.` };
  if (track.type !== 'video' && track.type !== 'audio') {
    return { reason: 'TYPE_MISMATCH', message: `INSERT_GENERATOR requires video or audio track.` };
  }
  const dur = state.timeline.duration;
  if (op.atFrame < 0 || op.atFrame + op.generator.duration > dur) {
    return { reason: 'OUT_OF_BOUNDS', message: `INSERT_GENERATOR would place clip outside timeline.` };
  }
  for (const c of track.clips) {
    const overlaps = op.atFrame < c.timelineEnd && op.atFrame + op.generator.duration > c.timelineStart;
    if (overlaps) return { reason: 'OVERLAP', message: `INSERT_GENERATOR would overlap clip '${c.id}'.` };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Phase 3: Caption validators
// ---------------------------------------------------------------------------

function validateAddCaption(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'ADD_CAPTION' }>,
): Rejection | null {
  const track = state.timeline.tracks.find((t) => t.id === op.trackId);
  if (!track) return { reason: 'OUT_OF_BOUNDS', message: `Track '${op.trackId}' not found.` };
  if (track.locked) return { reason: 'LOCKED_TRACK', message: `Track '${op.trackId}' is locked.` };
  const { caption } = op;
  if (caption.startFrame >= caption.endFrame) {
    return { reason: 'OUT_OF_BOUNDS', message: `Caption startFrame must be < endFrame.` };
  }
  if (caption.endFrame > state.timeline.duration) {
    return { reason: 'OUT_OF_BOUNDS', message: `Caption endFrame exceeds timeline duration.` };
  }
  if (track.captions.some((c) => c.id === caption.id)) {
    return { reason: 'OUT_OF_BOUNDS', message: `Caption '${caption.id}' already on track.` };
  }
  const overlaps = track.captions.some(
    (c) => caption.startFrame < c.endFrame && caption.endFrame > c.startFrame,
  );
  if (overlaps) {
    return { reason: 'OVERLAP', message: `Caption overlaps an existing caption on track '${op.trackId}'.` };
  }
  return null;
}

function validateEditCaption(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'EDIT_CAPTION' }>,
): Rejection | null {
  const track = state.timeline.tracks.find((t) => t.id === op.trackId);
  if (!track) return { reason: 'NOT_FOUND', message: `Track '${op.trackId}' not found.` };
  const caption = track.captions.find((c) => c.id === op.captionId);
  if (!caption) return { reason: 'NOT_FOUND', message: `Caption '${op.captionId}' not found on track.` };
  if (op.startFrame !== undefined && op.endFrame !== undefined) {
    if (op.startFrame >= op.endFrame) return { reason: 'OUT_OF_BOUNDS', message: `startFrame must be < endFrame.` };
    if (op.endFrame > state.timeline.duration) return { reason: 'OUT_OF_BOUNDS', message: `endFrame exceeds timeline duration.` };
  } else if (op.startFrame !== undefined) {
    if (op.startFrame >= caption.endFrame) return { reason: 'OUT_OF_BOUNDS', message: `startFrame must be < endFrame.` };
  } else if (op.endFrame !== undefined) {
    if (caption.startFrame >= op.endFrame) return { reason: 'OUT_OF_BOUNDS', message: `endFrame must be > startFrame.` };
    if (op.endFrame > state.timeline.duration) return { reason: 'OUT_OF_BOUNDS', message: `endFrame exceeds timeline duration.` };
  }
  return null;
}

function validateDeleteCaption(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'DELETE_CAPTION' }>,
): Rejection | null {
  const track = state.timeline.tracks.find((t) => t.id === op.trackId);
  if (!track) return { reason: 'NOT_FOUND', message: `Track '${op.trackId}' not found.` };
  if (!track.captions.some((c) => c.id === op.captionId)) {
    return { reason: 'NOT_FOUND', message: `Caption '${op.captionId}' not found on track.` };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Phase 4: Effect & Keyframe validators
// ---------------------------------------------------------------------------

function validateAddEffect(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'ADD_EFFECT' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  const effects = clip.effects ?? [];
  if (effects.some((e) => e.id === op.effect.id)) {
    return { reason: 'DUPLICATE_EFFECT_ID', message: `Effect '${op.effect.id}' already exists on clip '${op.clipId}'.` };
  }
  return null;
}

function validateRemoveEffect(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'REMOVE_EFFECT' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  const effect = findEffect(clip, op.effectId);
  if (!effect) return { reason: 'EFFECT_NOT_FOUND', message: `Effect '${op.effectId}' not found on clip '${op.clipId}'.` };
  return null;
}

function validateReorderEffect(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'REORDER_EFFECT' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  const effect = findEffect(clip, op.effectId);
  if (!effect) return { reason: 'EFFECT_NOT_FOUND', message: `Effect '${op.effectId}' not found on clip '${op.clipId}'.` };
  const effects = clip.effects ?? [];
  if (op.newIndex < 0 || op.newIndex >= effects.length) {
    return { reason: 'EFFECT_INDEX_OUT_OF_RANGE', message: `newIndex ${op.newIndex} out of range [0, ${effects.length - 1}].` };
  }
  return null;
}

function validateSetEffectEnabled(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SET_EFFECT_ENABLED' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  const effect = findEffect(clip, op.effectId);
  if (!effect) return { reason: 'EFFECT_NOT_FOUND', message: `Effect '${op.effectId}' not found on clip '${op.clipId}'.` };
  return null;
}

function validateSetEffectParam(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SET_EFFECT_PARAM' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  const effect = findEffect(clip, op.effectId);
  if (!effect) return { reason: 'EFFECT_NOT_FOUND', message: `Effect '${op.effectId}' not found on clip '${op.clipId}'.` };
  return null;
}

function validateAddKeyframe(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'ADD_KEYFRAME' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  const effect = findEffect(clip, op.effectId);
  if (!effect) return { reason: 'EFFECT_NOT_FOUND', message: `Effect '${op.effectId}' not found on clip '${op.clipId}'.` };
  if (effect.keyframes.some((k) => k.id === op.keyframe.id)) {
    return { reason: 'DUPLICATE_KEYFRAME_ID', message: `Keyframe '${op.keyframe.id}' already exists on effect '${op.effectId}'.` };
  }
  if (op.keyframe.frame < 0) {
    return { reason: 'INVALID_RANGE', message: `Keyframe frame (${op.keyframe.frame}) must be >= 0.` };
  }
  return null;
}

function validateMoveKeyframe(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'MOVE_KEYFRAME' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  const effect = findEffect(clip, op.effectId);
  if (!effect) return { reason: 'EFFECT_NOT_FOUND', message: `Effect '${op.effectId}' not found on clip '${op.clipId}'.` };
  const kf = effect.keyframes.find((k) => k.id === op.keyframeId);
  if (!kf) return { reason: 'KEYFRAME_NOT_FOUND', message: `Keyframe '${op.keyframeId}' not found on effect '${op.effectId}'.` };
  if (op.newFrame < 0) {
    return { reason: 'INVALID_RANGE', message: `newFrame (${op.newFrame}) must be >= 0.` };
  }
  return null;
}

function validateDeleteKeyframe(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'DELETE_KEYFRAME' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  const effect = findEffect(clip, op.effectId);
  if (!effect) return { reason: 'EFFECT_NOT_FOUND', message: `Effect '${op.effectId}' not found on clip '${op.clipId}'.` };
  const kf = effect.keyframes.find((k) => k.id === op.keyframeId);
  if (!kf) return { reason: 'KEYFRAME_NOT_FOUND', message: `Keyframe '${op.keyframeId}' not found on effect '${op.effectId}'.` };
  return null;
}

function validateSetKeyframeEasing(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SET_KEYFRAME_EASING' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  const effect = findEffect(clip, op.effectId);
  if (!effect) return { reason: 'EFFECT_NOT_FOUND', message: `Effect '${op.effectId}' not found on clip '${op.clipId}'.` };
  const kf = effect.keyframes.find((k) => k.id === op.keyframeId);
  if (!kf) return { reason: 'KEYFRAME_NOT_FOUND', message: `Keyframe '${op.keyframeId}' not found on effect '${op.effectId}'.` };
  return null;
}

// ---------------------------------------------------------------------------
// Phase 4 Step 3: Transform, Audio, Transitions, LinkGroups, TrackGroups
// ---------------------------------------------------------------------------

function validateSetClipTransform(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SET_CLIP_TRANSFORM' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  return null;
}

function validateSetAudioProperties(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SET_AUDIO_PROPERTIES' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  const p = op.properties;
  if (p.pan !== undefined && typeof p.pan === 'object' && p.pan !== null && 'value' in p.pan) {
    const v = (p.pan as { value: number }).value;
    if (v < -1 || v > 1) {
      return { reason: 'INVALID_RANGE', message: `pan must be in [-1, 1].` };
    }
  }
  if (p.normalizationGain !== undefined && p.normalizationGain < 0) {
    return { reason: 'INVALID_RANGE', message: `normalizationGain must be >= 0.` };
  }
  return null;
}

function validateAddTransition(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'ADD_TRANSITION' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  if (op.transition.durationFrames <= 0) {
    return { reason: 'INVALID_RANGE', message: `transition.durationFrames must be > 0.` };
  }
  return null;
}

function validateDeleteTransition(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'DELETE_TRANSITION' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  if (!clip.transition) {
    return { reason: 'TRANSITION_NOT_FOUND', message: `Clip '${op.clipId}' has no transition to delete.` };
  }
  return null;
}

function validateSetTransitionDuration(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SET_TRANSITION_DURATION' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  if (!clip.transition) {
    return { reason: 'TRANSITION_NOT_FOUND', message: `Clip '${op.clipId}' has no transition.` };
  }
  if (op.durationFrames <= 0) {
    return { reason: 'INVALID_RANGE', message: `durationFrames must be > 0.` };
  }
  return null;
}

function validateSetTransitionAlignment(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SET_TRANSITION_ALIGNMENT' }>,
): Rejection | null {
  const clip = findClip(state, op.clipId);
  if (!clip) return { reason: 'CLIP_NOT_FOUND', message: `Clip '${op.clipId}' not found.` };
  if (!clip.transition) {
    return { reason: 'TRANSITION_NOT_FOUND', message: `Clip '${op.clipId}' has no transition.` };
  }
  return null;
}

function validateLinkClips(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'LINK_CLIPS' }>,
): Rejection | null {
  const linkGroup = op.linkGroup;
  if (!linkGroup.clipIds.length || linkGroup.clipIds.length < 2) {
    return { reason: 'INVALID_RANGE', message: `linkGroup.clipIds must have length >= 2.` };
  }
  for (const cid of linkGroup.clipIds) {
    if (!findClip(state, cid)) {
      return { reason: 'CLIP_NOT_FOUND', message: `Clip '${cid}' not found.` };
    }
  }
  const existing = state.timeline.linkGroups ?? [];
  if (existing.some((g) => g.id === linkGroup.id)) {
    return { reason: 'DUPLICATE_LINK_GROUP_ID', message: `Link group '${linkGroup.id}' already exists.` };
  }
  return null;
}

function validateUnlinkClips(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'UNLINK_CLIPS' }>,
): Rejection | null {
  const groups = state.timeline.linkGroups ?? [];
  if (!groups.some((g) => g.id === op.linkGroupId)) {
    return { reason: 'LINK_GROUP_NOT_FOUND', message: `Link group '${op.linkGroupId}' not found.` };
  }
  return null;
}

function validateAddTrackGroup(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'ADD_TRACK_GROUP' }>,
): Rejection | null {
  const groups = state.timeline.trackGroups ?? [];
  if (groups.some((g) => g.id === op.trackGroup.id)) {
    return { reason: 'DUPLICATE_TRACK_GROUP_ID', message: `Track group '${op.trackGroup.id}' already exists.` };
  }
  for (const tid of op.trackGroup.trackIds) {
    if (!state.timeline.tracks.some((t) => t.id === tid)) {
      return { reason: 'TRACK_NOT_FOUND', message: `Track '${tid}' not found.` };
    }
  }
  return null;
}

function validateDeleteTrackGroup(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'DELETE_TRACK_GROUP' }>,
): Rejection | null {
  const groups = state.timeline.trackGroups ?? [];
  if (!groups.some((g) => g.id === op.trackGroupId)) {
    return { reason: 'TRACK_GROUP_NOT_FOUND', message: `Track group '${op.trackGroupId}' not found.` };
  }
  return null;
}

function validateSetTrackBlendMode(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SET_TRACK_BLEND_MODE' }>,
): Rejection | null {
  const track = state.timeline.tracks.find((t) => t.id === op.trackId);
  if (!track) return { reason: 'TRACK_NOT_FOUND', message: `Track '${op.trackId}' not found.` };
  return null;
}

function validateSetTrackOpacity(
  state: TimelineState,
  op: Extract<OperationPrimitive, { type: 'SET_TRACK_OPACITY' }>,
): Rejection | null {
  const track = state.timeline.tracks.find((t) => t.id === op.trackId);
  if (!track) return { reason: 'TRACK_NOT_FOUND', message: `Track '${op.trackId}' not found.` };
  if (op.opacity < 0 || op.opacity > 1) {
    return { reason: 'INVALID_OPACITY', message: `opacity must be in [0, 1].` };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function findEffect(clip: Clip, effectId: EffectId): Effect | undefined {
  const effects = clip.effects ?? [];
  return effects.find((e) => e.id === effectId);
}

function findClip(state: TimelineState, clipId: string) {
  for (const track of state.timeline.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return clip;
  }
  return undefined;
}

function findMarker(state: TimelineState, markerId: string) {
  return state.timeline.markers.find((m) => m.id === markerId);
}
