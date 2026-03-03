/**
 * INVARIANT CHECKER — Phase 0 compliant
 *
 * The most critical file in the engine.
 * checkInvariants() runs after every proposed state change inside the Dispatcher.
 * Zero violations is the only acceptable result in tests and at commit time.
 *
 * RULE: Run checkInvariants in EVERY test after every state mutation.
 */

import type { TimelineState } from '../types/state';
import { CURRENT_SCHEMA_VERSION } from '../types/state';
import type { Track } from '../types/track';
import type { Clip } from '../types/clip';
import { clipsOverlap } from '../types/clip';
import type { InvariantViolation } from '../types/operations';

// ---------------------------------------------------------------------------
// checkInvariants — the 9 checks from the spec, in order
// ---------------------------------------------------------------------------

export function checkInvariants(state: TimelineState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  // —— Schema version check (runs first — a version mismatch invalidates everything) ——
  if (state.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    violations.push({
      type:     'SCHEMA_VERSION_MISMATCH',
      entityId: 'timeline',
      message:  `Expected schema v${CURRENT_SCHEMA_VERSION}, got v${state.schemaVersion}`,
    });
    return violations;
  }

  for (const track of state.timeline.tracks) {
    checkTrack(state, track, violations);
  }

  // —— Phase 3: Marker bounds —————————————————————————————————————————————
  checkMarkerBounds(state, violations);
  // —— Phase 3: In/Out points —————————————————————————————————────────—————
  checkInOutPoints(state, violations);
  // —— Phase 3: Beat grid ——————————————————————————————————————————————————
  checkBeatGrid(state, violations);
  // —— Phase 4 Step 3: Link groups, Track groups —————————————————────────——
  checkLinkGroups(state, violations);
  checkTrackGroups(state, violations);

  return violations;
}

// ---------------------------------------------------------------------------
// Per-track checks
// ---------------------------------------------------------------------------

function checkTrack(
  state: TimelineState,
  track: Track,
  violations: InvariantViolation[],
): void {
  const clips = track.clips;

  // —— Check 8: clips[] must be sorted ascending by timelineStart ——————————
  for (let i = 1; i < clips.length; i++) {
    const prev = clips[i - 1]!;
    const curr = clips[i]!;
    if (prev.timelineStart > curr.timelineStart) {
      violations.push({
        type: 'TRACK_NOT_SORTED',
        entityId: track.id,
        message:
          `Track '${track.id}': clip '${curr.id}' (start=${curr.timelineStart}) ` +
          `appears after clip '${prev.id}' (start=${prev.timelineStart}) — not sorted.`,
      });
    }
  }

  // —— Check 1: No two clips share any frame (OVERLAP) ————————————————————
  for (let i = 0; i < clips.length; i++) {
    for (let j = i + 1; j < clips.length; j++) {
      const a = clips[i]!;
      const b = clips[j]!;
      if (clipsOverlap(a, b)) {
        violations.push({
          type: 'OVERLAP',
          entityId: a.id,
          message:
            `Track '${track.id}': clips '${a.id}' [${a.timelineStart}-${a.timelineEnd}) ` +
            `and '${b.id}' [${b.timelineStart}-${b.timelineEnd}) overlap.`,
        });
      }
    }
  }

  // Per-clip checks
  for (const clip of clips) {
    checkClip(state, track, clip, violations);
  }

  // —— Phase 3: Caption bounds (per track) —————————————————————————————————
  checkCaptionBounds(state, track, violations);
}

// ---------------------------------------------------------------------------
// Per-clip checks
// ---------------------------------------------------------------------------

function checkClip(
  state: TimelineState,
  track: Track,
  clip: Clip,
  violations: InvariantViolation[],
): void {
  // —— Check 2: assetId must exist in assetRegistry (ASSET_MISSING) —————————
  const asset = state.assetRegistry.get(clip.assetId);
  if (!asset) {
    violations.push({
      type: 'ASSET_MISSING',
      entityId: clip.id,
      message: `Clip '${clip.id}' references asset '${clip.assetId}' which is not in the registry.`,
    });
    // Cannot run media-bounds checks without the asset — skip remaining checks
    return;
  }

  // —— Check 3: mediaType must match track type (TRACK_TYPE_MISMATCH) ————
  if (asset.mediaType !== track.type) {
    violations.push({
      type: 'TRACK_TYPE_MISMATCH',
      entityId: clip.id,
      message:
        `Clip '${clip.id}' has asset mediaType '${asset.mediaType}' ` +
        `but is on a '${track.type}' track '${track.id}'.`,
    });
  }

  // —— Check 4: mediaIn >= 0 (MEDIA_BOUNDS_INVALID) ————————————————————
  if (clip.mediaIn < 0) {
    violations.push({
      type: 'MEDIA_BOUNDS_INVALID',
      entityId: clip.id,
      message: `Clip '${clip.id}': mediaIn (${clip.mediaIn}) must be >= 0.`,
    });
  }

  // —— Check 5: mediaOut <= asset.intrinsicDuration (MEDIA_BOUNDS_INVALID) —
  if (clip.mediaOut > asset.intrinsicDuration) {
    violations.push({
      type: 'MEDIA_BOUNDS_INVALID',
      entityId: clip.id,
      message:
        `Clip '${clip.id}': mediaOut (${clip.mediaOut}) exceeds ` +
        `asset intrinsicDuration (${asset.intrinsicDuration}).`,
    });
  }

  // —— Check 6: (mediaOut - mediaIn) === (timelineEnd - timelineStart) / speed ——
  const mediaDuration = clip.mediaOut - clip.mediaIn;
  const timelineDuration = clip.timelineEnd - clip.timelineStart;
  const expectedMediaDuration = timelineDuration / clip.speed;
  if (Math.abs(mediaDuration - expectedMediaDuration) > 0.5) {
    violations.push({
      type: 'DURATION_MISMATCH',
      entityId: clip.id,
      message:
        `Clip '${clip.id}': mediaDuration (${mediaDuration}) ≠ ` +
        `timelineDuration/speed (${expectedMediaDuration.toFixed(2)}).`,
    });
  }

  // —— Check 7: timelineEnd <= timeline.duration (CLIP_BEYOND_TIMELINE) ————
  if (clip.timelineEnd > state.timeline.duration) {
    violations.push({
      type: 'CLIP_BEYOND_TIMELINE',
      entityId: clip.id,
      message:
        `Clip '${clip.id}': timelineEnd (${clip.timelineEnd}) exceeds ` +
        `timeline duration (${state.timeline.duration}).`,
    });
  }

  // —— Check 9: speed > 0 (SPEED_INVALID) ————————————————————————————
  if (clip.speed <= 0) {
    violations.push({
      type: 'SPEED_INVALID',
      entityId: clip.id,
      message: `Clip '${clip.id}': speed (${clip.speed}) must be > 0.`,
    });
  }

  // —— Phase 4: Effects (keyframe order, renderStage) ———————————————————
  checkEffects(clip, violations);
  // —— Phase 4 Step 3: Transition ————————————————————————————————————————
  checkTransitions(clip, state, violations);
}

function checkEffects(
  clip: Clip,
  violations: InvariantViolation[],
): void {
  const effects = clip.effects ?? [];
  const validStages = ['preComposite', 'postComposite', 'output'] as const;
  for (const effect of effects) {
    if (!validStages.includes(effect.renderStage)) {
      violations.push({
        type: 'INVALID_RENDER_STAGE',
        entityId: effect.id,
        message: `Effect '${effect.id}': renderStage '${effect.renderStage}' is invalid.`,
      });
    }
    const kfs = effect.keyframes;
    for (let i = 1; i < kfs.length; i++) {
      const prev = kfs[i - 1]!;
      const curr = kfs[i]!;
      if (prev.frame > curr.frame || prev.frame === curr.frame) {
        violations.push({
          type: 'KEYFRAME_ORDER_VIOLATION',
          entityId: effect.id,
          message: `Effect '${effect.id}': keyframes must be sorted ascending by frame with no duplicates.`,
        });
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Marker bounds
// ---------------------------------------------------------------------------

function checkMarkerBounds(
  state: TimelineState,
  violations: InvariantViolation[],
): void {
  const dur = state.timeline.duration;
  for (const m of state.timeline.markers) {
    if (m.type === 'point') {
      if (m.frame < 0) {
        violations.push({
          type: 'MARKER_OUT_OF_BOUNDS',
          entityId: m.id,
          message: `Point marker '${m.id}' frame (${m.frame}) must be >= 0.`,
        });
      }
      if (m.frame >= dur) {
        violations.push({
          type: 'MARKER_OUT_OF_BOUNDS',
          entityId: m.id,
          message: `Point marker '${m.id}' frame (${m.frame}) must be < timeline duration (${dur}).`,
        });
      }
    } else {
      if (m.frameStart < 0) {
        violations.push({
          type: 'MARKER_OUT_OF_BOUNDS',
          entityId: m.id,
          message: `Range marker '${m.id}' frameStart (${m.frameStart}) must be >= 0.`,
        });
      }
      if (m.frameStart >= dur) {
        violations.push({
          type: 'MARKER_OUT_OF_BOUNDS',
          entityId: m.id,
          message: `Range marker '${m.id}' frameStart (${m.frameStart}) must be < timeline duration (${dur}).`,
        });
      }
      if (m.frameEnd > dur) {
        violations.push({
          type: 'MARKER_OUT_OF_BOUNDS',
          entityId: m.id,
          message: `Range marker '${m.id}' frameEnd (${m.frameEnd}) exceeds timeline duration (${dur}).`,
        });
      }
      if (m.frameEnd <= m.frameStart) {
        violations.push({
          type: 'MARKER_OUT_OF_BOUNDS',
          entityId: m.id,
          message: `Range marker '${m.id}' frameEnd must be > frameStart.`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 3: In/Out points
// ---------------------------------------------------------------------------

function checkInOutPoints(
  state: TimelineState,
  violations: InvariantViolation[],
): void {
  const dur = state.timeline.duration;
  const inPt = state.timeline.inPoint;
  const outPt = state.timeline.outPoint;
  if (inPt !== null && inPt < 0) {
    violations.push({
      type: 'IN_OUT_INVALID',
      entityId: 'timeline',
      message: `In point (${inPt}) must be >= 0.`,
    });
  }
  if (outPt !== null && outPt > dur) {
    violations.push({
      type: 'IN_OUT_INVALID',
      entityId: 'timeline',
      message: `Out point (${outPt}) must be <= timeline duration (${dur}).`,
    });
  }
  if (inPt !== null && outPt !== null && inPt >= outPt) {
    violations.push({
      type: 'IN_OUT_INVALID',
      entityId: 'timeline',
      message: `In point (${inPt}) must be < out point (${outPt}).`,
    });
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Beat grid
// ---------------------------------------------------------------------------

function checkBeatGrid(
  state: TimelineState,
  violations: InvariantViolation[],
): void {
  const bg = state.timeline.beatGrid;
  if (bg === null) return;
  if (bg.bpm <= 0) {
    violations.push({
      type: 'BEAT_GRID_INVALID',
      entityId: 'timeline',
      message: `Beat grid bpm (${bg.bpm}) must be > 0.`,
    });
  }
  if (bg.timeSignature[0] <= 0 || bg.timeSignature[1] <= 0) {
    violations.push({
      type: 'BEAT_GRID_INVALID',
      entityId: 'timeline',
      message: `Beat grid timeSignature must be positive.`,
    });
  }
}

// ---------------------------------------------------------------------------
// Phase 3: Caption bounds (per track)
// ---------------------------------------------------------------------------

function checkCaptionBounds(
  state: TimelineState,
  track: Track,
  violations: InvariantViolation[],
): void {
  const dur = state.timeline.duration;
  for (const cap of track.captions) {
    if (cap.endFrame > dur) {
      violations.push({
        type: 'CAPTION_OUT_OF_BOUNDS',
        entityId: cap.id,
        message: `Caption '${cap.id}' endFrame (${cap.endFrame}) exceeds timeline duration (${dur}).`,
      });
    }
    if (cap.endFrame <= cap.startFrame) {
      violations.push({
        type: 'CAPTION_OUT_OF_BOUNDS',
        entityId: cap.id,
        message: `Caption '${cap.id}' endFrame must be > startFrame.`,
      });
    }
  }
  const byStart = [...track.captions].sort((a, b) => a.startFrame - b.startFrame);
  for (let i = 0; i < byStart.length - 1; i++) {
    const a = byStart[i]!;
    const b = byStart[i + 1]!;
    if (a.endFrame > b.startFrame) {
      violations.push({
        type: 'CAPTION_OVERLAP',
        entityId: track.id,
        message: `Captions '${a.id}' and '${b.id}' overlap on track '${track.id}'.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 4 Step 3: Transitions (per clip)
// ---------------------------------------------------------------------------

const VALID_TRANSITION_ALIGNMENTS = ['centerOnCut', 'endAtCut', 'startAtCut'] as const;

function checkTransitions(
  clip: Clip,
  state: TimelineState,
  violations: InvariantViolation[],
): void {
  const trans = clip.transition;
  if (!trans) return;
  if (trans.durationFrames <= 0) {
    violations.push({
      type: 'INVALID_RANGE',
      entityId: clip.id,
      message: `Clip '${clip.id}' transition durationFrames (${trans.durationFrames}) must be > 0.`,
    });
  }
  if (!VALID_TRANSITION_ALIGNMENTS.includes(trans.alignment as typeof VALID_TRANSITION_ALIGNMENTS[number])) {
    violations.push({
      type: 'INVALID_RANGE',
      entityId: clip.id,
      message: `Clip '${clip.id}' transition alignment '${trans.alignment}' is invalid.`,
    });
  }
}

// ---------------------------------------------------------------------------
// Phase 4 Step 3: Link groups
// ---------------------------------------------------------------------------

function checkLinkGroups(state: TimelineState, violations: InvariantViolation[]): void {
  const groups = state.timeline.linkGroups ?? [];
  const clipIdsInGroups = new Map<string, number>();
  for (const g of groups) {
    if (g.clipIds.length < 2) {
      violations.push({
        type: 'INVALID_RANGE',
        entityId: g.id,
        message: `Link group '${g.id}' must have at least 2 clipIds.`,
      });
    }
    for (const cid of g.clipIds) {
      const clip = findClipInState(state, cid);
      if (!clip) {
        violations.push({
          type: 'LINK_GROUP_NOT_FOUND',
          entityId: g.id,
          message: `Link group '${g.id}' references non-existent clip '${cid}'.`,
        });
      }
      const count = (clipIdsInGroups.get(cid) ?? 0) + 1;
      clipIdsInGroups.set(cid, count);
    }
  }
  for (const [cid, count] of clipIdsInGroups) {
    if (count > 1) {
      violations.push({
        type: 'INVALID_RANGE',
        entityId: cid,
        message: `Clip '${cid}' appears in more than one link group.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 4 Step 3: Track groups
// ---------------------------------------------------------------------------

function checkTrackGroups(state: TimelineState, violations: InvariantViolation[]): void {
  const groups = state.timeline.trackGroups ?? [];
  const groupIds = new Set(groups.map((g) => g.id));
  for (const g of groups) {
    for (const tid of g.trackIds) {
      if (!state.timeline.tracks.some((t) => t.id === tid)) {
        violations.push({
          type: 'TRACK_GROUP_NOT_FOUND',
          entityId: g.id,
          message: `Track group '${g.id}' references non-existent track '${tid}'.`,
        });
      }
    }
  }
  for (const track of state.timeline.tracks) {
    const gid = track.groupId;
    if (gid !== undefined && !groupIds.has(gid)) {
      violations.push({
        type: 'TRACK_GROUP_NOT_FOUND',
        entityId: track.id,
        message: `Track '${track.id}' has groupId '${gid}' which does not exist.`,
      });
    }
  }
}

function findClipInState(state: TimelineState, clipId: string): Clip | undefined {
  for (const track of state.timeline.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return clip;
  }
  return undefined;
}
