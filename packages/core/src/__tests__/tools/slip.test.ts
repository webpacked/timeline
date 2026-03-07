/**
 * SlipTool Tests — Phase 2 Step 5
 *
 * Covers all items from the approved test plan:
 *   □ Slip right: mediaIn and mediaOut both increase by delta
 *   □ Slip left: mediaIn and mediaOut both decrease by delta
 *   □ timelineStart/End identical before and after (explicit assertion)
 *   □ Clamp at mediaIn floor: delta clamped when mediaIn would go below 0
 *   □ Clamp at mediaOut ceiling: delta clamped when mediaOut would exceed intrinsicDuration
 *   □ No-op: clampedDelta === 0 → null Transaction
 *   □ Empty space click: no drag, onPointerUp null
 *   □ Ghost: mediaIn/Out shifted, timelineStart/End unchanged
 *   □ checkInvariants + dispatch.accepted on every Transaction
 *   □ operations.length === 1 on every Transaction (SET_MEDIA_BOUNDS only)
 *
 * Zero React imports.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { SlipTool }         from '../../tools/slip';
import { checkInvariants }  from '../../validation/invariants';
import { dispatch }         from '../../engine/dispatcher';
import { createTimelineState } from '../../types/state';
import { createTimeline }   from '../../types/timeline';
import { createTrack, toTrackId } from '../../types/track';
import { createClip, toClipId }   from '../../types/clip';
import { createAsset, toAssetId } from '../../types/asset';
import { toFrame, toTimecode, frameRate } from '../../types/frame';
import { buildSnapIndex }   from '../../snap-index';
import type { ToolContext, TimelinePointerEvent } from '../../tools/types';
import type { TimelineState }   from '../../types/state';
import type { TimelineFrame }   from '../../types/frame';
import type { TrackId }         from '../../types/track';
import type { ClipId }          from '../../types/clip';

// ── Constants ─────────────────────────────────────────────────────────────────

const TRACK_ID  = toTrackId('track-1');
const ASSET_ID  = toAssetId('asset-1');
const CLIP_ID   = toClipId('clip-a');

// ── Fixture builders ──────────────────────────────────────────────────────────

/**
 * Default clip:
 *   timeline:  [100, 300)  — 200 frames on timeline
 *   media:     mediaIn=50, mediaOut=250 — 200 frames of media, centred in asset
 *   asset:     intrinsicDuration=500
 *
 *  Leftward headroom  (minDelta): -50   (mediaIn can fall to 0)
 *  Rightward headroom (maxDelta): +250  (mediaOut can rise to 500)
 *
 * This gives ample room to test both clamp directions and free slip.
 */
function makeState(): TimelineState {
  const asset = createAsset({
    id: 'asset-1', name: 'Test', mediaType: 'video',
    filePath: '/media/test.mp4',
    intrinsicDuration: toFrame(500),
    nativeFps: 30, sourceTimecodeOffset: toFrame(0), status: 'online',
  });
  const clip = createClip({
    id: 'clip-a', assetId: 'asset-1', trackId: 'track-1',
    timelineStart: toFrame(100), timelineEnd: toFrame(300),
    mediaIn: toFrame(50), mediaOut: toFrame(250),
  });
  const track = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [clip] });
  const timeline = createTimeline({
    id: 'tl', name: 'Slip Test', fps: frameRate(30),
    duration: toFrame(9000), startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[ASSET_ID, asset]]) });
}

function makeCtx(state: TimelineState, overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    state,
    snapIndex:      buildSnapIndex(state, toFrame(0)),
    pixelsPerFrame: 10,
    modifiers:      { shift: false, alt: false, ctrl: false, meta: false },
    frameAtX:       (x) => toFrame(Math.floor(x / 10)),
    trackAtY:       (_y) => TRACK_ID,
    snap:           (frame, _excl?) => frame,
    ...overrides,
  };
}

function makeEv(overrides: {
  frame?: TimelineFrame; trackId?: TrackId | null; clipId?: ClipId | null;
  x?: number; y?: number;
} = {}): TimelinePointerEvent {
  return {
    frame:    overrides.frame   ?? toFrame(0),
    trackId:  overrides.trackId ?? TRACK_ID,
    clipId:   overrides.clipId  ?? null,
    x:        overrides.x       ?? 0,
    y:        overrides.y       ?? 24,
    buttons:  1,
    shiftKey: false, altKey: false, metaKey: false,
  };
}

/** Initiate a drag on CLIP_ID starting at frame 200 (middle of timeline clip). */
function startDrag(tool: SlipTool, state: TimelineState) {
  const ctx = makeCtx(state);
  tool.onPointerDown(makeEv({ clipId: CLIP_ID, frame: toFrame(200) }), ctx);
}

function applyAndCheck(state: TimelineState, tx: ReturnType<SlipTool['onPointerUp']>): TimelineState {
  expect(tx).not.toBeNull();
  const result = dispatch(state, tx!);
  expect(result.accepted).toBe(true);
  if (result.accepted) {
    expect(checkInvariants(result.nextState)).toHaveLength(0);
  }
  return result.accepted ? result.nextState : state;
}

// ── Suite 1: Slip right ───────────────────────────────────────────────────────

describe('SlipTool — slip RIGHT: mediaIn and mediaOut increase by delta', () => {
  let tool: SlipTool;
  let state: TimelineState;

  beforeEach(() => { tool = new SlipTool(); state = makeState(); });

  it('single SET_MEDIA_BOUNDS — operations.length === 1', () => {
    startDrag(tool, state);
    const ctx = makeCtx(state);
    // Drag right by 30 frames: start=200, end=230 → delta=+30
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_ID, frame: toFrame(230) }), ctx);

    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(1);          // ← defining assertion
    expect(tx!.operations[0]!.type).toBe('SET_MEDIA_BOUNDS');
  });

  it('mediaIn and mediaOut both increase by +30', () => {
    startDrag(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_ID, frame: toFrame(230) }), ctx);

    const op = tx!.operations[0]!;
    if (op.type === 'SET_MEDIA_BOUNDS') {
      expect(op.mediaIn).toBe(toFrame(80));   // 50 + 30
      expect(op.mediaOut).toBe(toFrame(280)); // 250 + 30
    }
  });

  it('timelineStart and timelineEnd are unchanged after dispatch', () => {
    startDrag(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_ID, frame: toFrame(230) }), ctx);
    const nextState = applyAndCheck(state, tx);

    const clip    = nextState.timeline.tracks[0]!.clips.find(c => c.id === CLIP_ID)!;
    const origClip = state.timeline.tracks[0]!.clips.find(c => c.id === CLIP_ID)!;

    // The defining characteristic of slip: position does NOT change
    expect(clip.timelineStart).toBe(origClip.timelineStart);
    expect(clip.timelineEnd).toBe(origClip.timelineEnd);
  });

  it('passes checkInvariants', () => {
    startDrag(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_ID, frame: toFrame(230) }), ctx);
    applyAndCheck(state, tx);
  });
});

// ── Suite 2: Slip left ────────────────────────────────────────────────────────

describe('SlipTool — slip LEFT: mediaIn and mediaOut decrease by delta', () => {
  let tool: SlipTool;
  let state: TimelineState;

  beforeEach(() => { tool = new SlipTool(); state = makeState(); });

  it('mediaIn and mediaOut both decrease by 20 (delta = -20)', () => {
    startDrag(tool, state);
    const ctx = makeCtx(state);
    // Drag left: start=200, end=180 → delta=-20
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_ID, frame: toFrame(180) }), ctx);

    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(1);

    const op = tx!.operations[0]!;
    if (op.type === 'SET_MEDIA_BOUNDS') {
      expect(op.mediaIn).toBe(toFrame(30));   // 50 - 20
      expect(op.mediaOut).toBe(toFrame(230)); // 250 - 20
    }
  });

  it('timelineStart and timelineEnd unchanged after left slip', () => {
    startDrag(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_ID, frame: toFrame(180) }), ctx);
    const nextState = applyAndCheck(state, tx);

    const clip    = nextState.timeline.tracks[0]!.clips.find(c => c.id === CLIP_ID)!;
    const origClip = state.timeline.tracks[0]!.clips.find(c => c.id === CLIP_ID)!;

    expect(clip.timelineStart).toBe(origClip.timelineStart);
    expect(clip.timelineEnd).toBe(origClip.timelineEnd);
  });

  it('passes checkInvariants', () => {
    startDrag(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_ID, frame: toFrame(180) }), ctx);
    applyAndCheck(state, tx);
  });
});

// ── Suite 3: Clamp at mediaIn floor ──────────────────────────────────────────

describe('SlipTool — clamp: mediaIn floor (cannot go below 0)', () => {
  it('delta clamped at -50 when dragging far left (mediaIn=50, minDelta=-50)', () => {
    // Asset starts at 0. mediaIn=50 → minDelta=-50. Dragging to -1000 → clamped to -50.
    const state = makeState();
    const tool  = new SlipTool();
    startDrag(tool, state);
    const ctx = makeCtx(state);

    // drag far left: want delta=-1000, clamped to -50
    // dragStart=200, dragEnd=200-1000=-800 (below timeline, but frames can be any integer)
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_ID, frame: toFrame(-800) }), ctx);

    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(1);
    const op = tx!.operations[0]!;
    if (op.type === 'SET_MEDIA_BOUNDS') {
      expect(op.mediaIn).toBe(toFrame(0));    // 50 + (-50) = 0 — floor
      expect(op.mediaOut).toBe(toFrame(200)); // 250 + (-50) = 200
    }
    applyAndCheck(state, tx);
  });

  it('exact clamp: dragging exactly to minDelta is allowed (not null)', () => {
    const state = makeState();
    const tool  = new SlipTool();
    startDrag(tool, state);
    const ctx = makeCtx(state);

    // delta = -50 exactly → mediaIn becomes 0
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_ID, frame: toFrame(150) }), ctx);

    expect(tx).not.toBeNull();
    const op = tx!.operations[0]!;
    if (op.type === 'SET_MEDIA_BOUNDS') {
      expect(op.mediaIn).toBe(toFrame(0));
    }
    applyAndCheck(state, tx);
  });
});

// ── Suite 4: Clamp at mediaOut ceiling ────────────────────────────────────────

describe('SlipTool — clamp: mediaOut ceiling (cannot exceed intrinsicDuration)', () => {
  it('delta clamped at +250 when dragging far right (mediaOut=250, maxDelta=250)', () => {
    // intrinsicDuration=500, mediaOut=250 → maxDelta=250. Dragging +1000 → clamped to +250.
    const state = makeState();
    const tool  = new SlipTool();
    startDrag(tool, state);
    const ctx = makeCtx(state);

    // dragStart=200, dragEnd=200+1000=1200 → delta=+1000, clamped to +250
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_ID, frame: toFrame(1200) }), ctx);

    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(1);
    const op = tx!.operations[0]!;
    if (op.type === 'SET_MEDIA_BOUNDS') {
      expect(op.mediaIn).toBe(toFrame(300));  // 50 + 250
      expect(op.mediaOut).toBe(toFrame(500)); // 250 + 250 = 500 = intrinsicDuration
    }
    applyAndCheck(state, tx);
  });

  it('exact clamp: dragging to maxDelta is allowed (not null)', () => {
    const state = makeState();
    const tool  = new SlipTool();
    startDrag(tool, state);
    const ctx = makeCtx(state);

    // delta = +250 exactly → mediaOut becomes 500 = intrinsicDuration
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_ID, frame: toFrame(450) }), ctx);

    expect(tx).not.toBeNull();
    const op = tx!.operations[0]!;
    if (op.type === 'SET_MEDIA_BOUNDS') {
      expect(op.mediaOut).toBe(toFrame(500));
    }
    applyAndCheck(state, tx);
  });
});

// ── Suite 5: No-op ────────────────────────────────────────────────────────────

describe('SlipTool — no-op: clampedDelta === 0 → null', () => {
  it('releasing at same frame as press → null', () => {
    const state = makeState();
    const tool  = new SlipTool();
    startDrag(tool, state);
    const ctx = makeCtx(state);

    // dragEnd = dragStart = 200 → delta = 0
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_ID, frame: toFrame(200) }), ctx);
    expect(tx).toBeNull();
  });
});

// ── Suite 6: Empty space click ────────────────────────────────────────────────

describe('SlipTool — empty space: no drag initiated', () => {
  it('clicking empty space (clipId=null) → onPointerUp returns null', () => {
    const state = makeState();
    const tool  = new SlipTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: null, frame: toFrame(50) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: null, frame: toFrame(150) }), ctx);
    expect(tx).toBeNull();
  });
});

// ── Suite 7: ProvisionalState ghost ──────────────────────────────────────────

describe('SlipTool — ProvisionalState ghost', () => {
  it('ghost has 1 clip — only the slipped clip', () => {
    const state = makeState();
    const tool  = new SlipTool();
    startDrag(tool, state);
    const ctx   = makeCtx(state);

    const ghost = tool.onPointerMove(
      makeEv({ clipId: CLIP_ID, frame: toFrame(220) }), ctx,
    );

    expect(ghost).not.toBeNull();
    expect(ghost!.isProvisional).toBe(true);
    expect(ghost!.clips).toHaveLength(1);
  });

  it('ghost mediaIn/Out shifted, timelineStart/End unchanged', () => {
    const state     = makeState();
    const origClip  = state.timeline.tracks[0]!.clips.find(c => c.id === CLIP_ID)!;
    const tool      = new SlipTool();
    startDrag(tool, state);
    const ctx       = makeCtx(state);

    // delta = 220 - 200 = +20
    const ghost     = tool.onPointerMove(
      makeEv({ clipId: CLIP_ID, frame: toFrame(220) }), ctx,
    );

    const ghostClip = ghost!.clips.find(c => c.id === CLIP_ID)!;

    // ← media shifted
    expect(ghostClip.mediaIn).toBe(toFrame(70));    // 50 + 20
    expect(ghostClip.mediaOut).toBe(toFrame(270));  // 250 + 20

    // ← timeline position unchanged
    expect(ghostClip.timelineStart).toBe(origClip.timelineStart);
    expect(ghostClip.timelineEnd).toBe(origClip.timelineEnd);
  });

  it('not mid-drag → onPointerMove returns null', () => {
    const state = makeState();
    const tool  = new SlipTool();
    const ctx   = makeCtx(state);

    // No pointerDown
    const ghost = tool.onPointerMove(makeEv({ clipId: CLIP_ID, frame: toFrame(220) }), ctx);
    expect(ghost).toBeNull();
  });
});

// ── Suite 8: onCancel and structural ─────────────────────────────────────────

describe('SlipTool — onCancel and structural', () => {
  it('onCancel resets drag state — subsequent pointerUp returns null', () => {
    const state = makeState();
    const tool  = new SlipTool();
    startDrag(tool, state);
    tool.onCancel();
    const ctx = makeCtx(state);
    const tx  = tool.onPointerUp(makeEv({ clipId: CLIP_ID, frame: toFrame(250) }), ctx);
    expect(tx).toBeNull();
  });

  it('getCursor returns ew-resize mid-drag', () => {
    const state = makeState();
    const tool  = new SlipTool();
    startDrag(tool, state);
    const ctx = makeCtx(state);
    expect(tool.getCursor(ctx)).toBe('ew-resize');
  });

  it('getCursor returns grab when hovering clip', () => {
    const state = makeState();
    const tool  = new SlipTool();
    const ctx   = makeCtx(state);
    // Stage hover
    tool.onPointerMove(makeEv({ clipId: CLIP_ID, frame: toFrame(200) }), ctx);
    expect(tool.getCursor(ctx)).toBe('grab');
  });

  it('getCursor returns default when idle and not hovering', () => {
    const state = makeState();
    const tool  = new SlipTool();
    const ctx   = makeCtx(state);
    // Move over empty space to stage isHoveringClip=false
    tool.onPointerMove(makeEv({ clipId: null, frame: toFrame(50) }), ctx);
    expect(tool.getCursor(ctx)).toBe('default');
  });

  it('getSnapCandidateTypes returns empty array', () => {
    const tool = new SlipTool();
    expect(tool.getSnapCandidateTypes()).toHaveLength(0);
  });

  it('has correct id and shortcutKey', () => {
    const tool = new SlipTool();
    expect(tool.id).toBe('slip');
    expect(tool.shortcutKey).toBe('y');
  });
});
