/**
 * RollTrimTool Tests — Phase 2 Step 4
 *
 * Covers all items from the approved test plan:
 *   □ Roll right: left shorter, right longer, combined duration unchanged
 *   □ Roll left: left longer, right shorter, combined duration unchanged
 *   □ Clamp at left media bound
 *   □ Clamp at right media bound
 *   □ Clamp at min-duration (left clip cannot reach 0 frames)
 *   □ No-op: pointerUp at original boundary → null
 *   □ No roll target (gap between clips) → null
 *   □ No roll target (single clip edge only) → null
 *   □ minBoundary > maxBoundary → no-op
 *   □ checkInvariants + dispatch.accepted on every Transaction
 *   □ Combined duration explicit assertion
 *
 * Zero React imports.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { RollTrimTool }     from '../../tools/roll-trim';
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
import type { TimelineState }  from '../../types/state';
import type { TimelineFrame }  from '../../types/frame';
import type { TrackId }        from '../../types/track';
import type { ClipId }         from '../../types/clip';

// ── Constants ────────────────────────────────────────────────────────────────

const TRACK_ID  = toTrackId('track-1');
const ASSET_ID  = toAssetId('asset-1');
const LEFT_ID   = toClipId('clip-left');
const RIGHT_ID  = toClipId('clip-right');

// ── Fixture builders ─────────────────────────────────────────────────────────

function makeAsset(dur = 1000) {
  return createAsset({
    id: 'asset-1', name: 'Test', mediaType: 'video',
    filePath: '/media/test.mp4',
    intrinsicDuration: toFrame(dur),
    nativeFps: 30, sourceTimecodeOffset: toFrame(0), status: 'online',
  });
}

/**
 * Default state:
 *   LEFT  [0,   200) — mediaIn=0,   mediaOut=200
 *   RIGHT [200, 400) — mediaIn=100, mediaOut=300
 *   Cut point at frame 200.
 *
 *   RIGHT.mediaIn=100 gives 100 frames of leftward headroom (constraint E):
 *     minBoundary from E = origBoundary - rightMediaIn = 200 - 100 = 100
 *   So leftward rolls up to frame 100 are allowed by media bounds.
 *
 * Optional: override to test specific media-bound clamping.
 */
function makeState({
  leftMediaIn  = 0,   leftMediaOut  = 200,
  rightMediaIn = 100, rightMediaOut = 300,
  rightStart   = 200,
  gap          = 0,
}: {
  leftMediaIn?:  number; leftMediaOut?:  number;
  rightMediaIn?: number; rightMediaOut?: number;
  rightStart?:   number; gap?:           number;
} = {}): TimelineState {
  const clipLeft = createClip({
    id: 'clip-left', assetId: 'asset-1', trackId: 'track-1',
    timelineStart: toFrame(0),       timelineEnd: toFrame(200),
    mediaIn: toFrame(leftMediaIn),   mediaOut: toFrame(leftMediaOut),
  });
  const clipRight = createClip({
    id: 'clip-right', assetId: 'asset-1', trackId: 'track-1',
    timelineStart: toFrame(rightStart + gap), timelineEnd: toFrame(rightStart + gap + 200),
    mediaIn: toFrame(rightMediaIn),  mediaOut: toFrame(rightMediaOut),
  });
  const track   = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [clipLeft, clipRight] });
  const timeline = createTimeline({
    id: 'tl', name: 'Roll Test', fps: frameRate(30),
    duration: toFrame(9000), startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[ASSET_ID, makeAsset()]]) });
}

function makeCtx(state: TimelineState, overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    state,
    snapIndex:      buildSnapIndex(state, toFrame(0)),
    pixelsPerFrame: 10,  // 1 frame = 10px, EDGE_ZONE_PX=8 → 0.8 frames
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

/** Grab the cut point at frame 200 to start a roll trim drag. */
function grabCut(tool: RollTrimTool, state: TimelineState) {
  const ctx = makeCtx(state);
  tool.onPointerDown(makeEv({ frame: toFrame(200) }), ctx);
}

function applyAndCheck(state: TimelineState, tx: ReturnType<RollTrimTool['onPointerUp']>) {
  expect(tx).not.toBeNull();
  const result = dispatch(state, tx!);
  expect(result.accepted).toBe(true);
  if (result.accepted) {
    expect(checkInvariants(result.nextState)).toHaveLength(0);
  }
  return result.accepted ? result.nextState : state;
}

// ── Suite 1: Roll right (boundary moves right) ────────────────────────────────

describe('RollTrimTool — roll RIGHT: left shorter, right longer', () => {
  let tool: RollTrimTool;
  let state: TimelineState;

  beforeEach(() => { tool = new RollTrimTool(); state = makeState(); });

  it('Transaction has 2× RESIZE_CLIP with identical newFrame', () => {
    grabCut(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(250) }), ctx);

    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(2);
    expect(tx!.operations[0]!.type).toBe('RESIZE_CLIP');
    expect(tx!.operations[1]!.type).toBe('RESIZE_CLIP');

    const op0 = tx!.operations[0]!;
    const op1 = tx!.operations[1]!;
    if (op0.type === 'RESIZE_CLIP' && op1.type === 'RESIZE_CLIP') {
      expect(op0.newFrame).toBe(toFrame(250));
      expect(op1.newFrame).toBe(toFrame(250));   // ← identical
      expect(op0.edge).toBe('end');
      expect(op1.edge).toBe('start');
      expect(op0.clipId).toBe(LEFT_ID);
      expect(op1.clipId).toBe(RIGHT_ID);
    }
  });

  it('combined duration unchanged after roll right', () => {
    grabCut(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(250) }), ctx);
    const nextState = applyAndCheck(state, tx);

    const track     = nextState.timeline.tracks[0]!;
    const newLeft   = track.clips.find(c => c.id === LEFT_ID)!;
    const newRight  = track.clips.find(c => c.id === RIGHT_ID)!;
    const origLeft  = state.timeline.tracks[0]!.clips.find(c => c.id === LEFT_ID)!;
    const origRight = state.timeline.tracks[0]!.clips.find(c => c.id === RIGHT_ID)!;

    const origCombined = (origLeft.timelineEnd - origLeft.timelineStart) +
                         (origRight.timelineEnd - origRight.timelineStart);
    const newCombined  = (newLeft.timelineEnd  - newLeft.timelineStart) +
                         (newRight.timelineEnd  - newRight.timelineStart);

    // THE defining invariant of roll trim
    expect(newCombined).toBe(origCombined);

    // Sanity: left shorter, right longer
    expect(newLeft.timelineEnd   - newLeft.timelineStart).toBe(250);   // was 200
    expect(newRight.timelineEnd  - newRight.timelineStart).toBe(150);  // was 200
  });

  it('passes checkInvariants', () => {
    grabCut(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(250) }), ctx);
    applyAndCheck(state, tx);
  });
});

// ── Suite 2: Roll left (boundary moves left) ──────────────────────────────────

describe('RollTrimTool — roll LEFT: left longer, right shorter', () => {
  let tool: RollTrimTool;
  let state: TimelineState;

  beforeEach(() => { tool = new RollTrimTool(); state = makeState(); });

  it('combined duration unchanged after roll left', () => {
    grabCut(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(150) }), ctx);
    const nextState = applyAndCheck(state, tx);

    const track     = nextState.timeline.tracks[0]!;
    const newLeft   = track.clips.find(c => c.id === LEFT_ID)!;
    const newRight  = track.clips.find(c => c.id === RIGHT_ID)!;

    expect(newLeft.timelineEnd  - newLeft.timelineStart).toBe(150);   // was 200
    expect(newRight.timelineEnd - newRight.timelineStart).toBe(250);  // was 200

    const combined = (newLeft.timelineEnd - newLeft.timelineStart) +
                     (newRight.timelineEnd - newRight.timelineStart);
    expect(combined).toBe(400);  // 200 + 200 = 400 unchanged
  });

  it('passes checkInvariants', () => {
    grabCut(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(150) }), ctx);
    applyAndCheck(state, tx);
  });
});

// ── Suite 3: Clamp — left media bound ────────────────────────────────────────

describe('RollTrimTool — clamp: left media bound (B\' rightward)', () => {
  it('cannot roll right past left clip intrinsicDuration', () => {
    // Constraint B': origBoundary + (intrinsicDuration - leftMediaOut) = 200 + (300 - 200) = 300
    // i.e. leftClip has 100 frames of rightward media supply
    // Rolling to frame 350 → clamped to 300
    // Use asset with intrinsicDuration=300, leftClip.mediaOut=200 → 100 frames ahead
    // rightClip also needs enough room: rightTimelineEnd must be > 300, and rightMediaIn
    // must cover rolling left (rightMediaIn >= delta_max). Use rightMediaIn=200.
    const leftAsset = createAsset({
      id: 'asset-1', name: 'T', mediaType: 'video', filePath: '/t.mp4',
      intrinsicDuration: toFrame(300),   // only 300 frames total → B' clamp at 300
      nativeFps: 30, sourceTimecodeOffset: toFrame(0), status: 'online',
    });
    const rightAsset = createAsset({
      id: 'asset-2', name: 'T2', mediaType: 'video', filePath: '/t2.mp4',
      intrinsicDuration: toFrame(1000),  // plenty of media — not the binding constraint
      nativeFps: 30, sourceTimecodeOffset: toFrame(0), status: 'online',
    });
    // LEFT: [0,200), mediaIn=0, mediaOut=200 → rightward headroom = 300-200 = 100 frames
    const clipLeft = createClip({
      id: 'clip-left', assetId: 'asset-1', trackId: 'track-1',
      timelineStart: toFrame(0), timelineEnd: toFrame(200),
      mediaIn: toFrame(0), mediaOut: toFrame(200),
    });
    // RIGHT: [200,500), mediaIn=200, mediaOut=500 (duration=300, uses asset-2)
    // rightMediaIn=200 → constraint E: 200-200=0 (can roll all the way left to 0, not binding)
    const clipRight = createClip({
      id: 'clip-right', assetId: 'asset-2', trackId: 'track-1',
      timelineStart: toFrame(200), timelineEnd: toFrame(500),
      mediaIn: toFrame(200), mediaOut: toFrame(500),
    });
    const track = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [clipLeft, clipRight] });
    const tl = createTimeline({ id: 'tl', name: 'T', fps: frameRate(30), duration: toFrame(9000), startTimecode: toTimecode('00:00:00:00'), tracks: [track] });
    const assetRegistry = new Map<typeof ASSET_ID, ReturnType<typeof createAsset>>([
      [toAssetId('asset-1'), leftAsset],
      [toAssetId('asset-2'), rightAsset],
    ]);
    const state = createTimelineState({ timeline: tl, assetRegistry });

    const tool = new RollTrimTool();
    const ctx  = makeCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(200) }), ctx);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(350) }), ctx);

    expect(tx).not.toBeNull();
    const op0 = tx!.operations[0]!;
    // maxBoundary = min(rightClip.timelineEnd-1=499, origBoundary+(intrinsicDuration-leftMediaOut)) = min(499, 200+100) = 300
    if (op0.type === 'RESIZE_CLIP') expect(op0.newFrame).toBe(toFrame(300));

    applyAndCheck(state, tx);
  });
});

// ── Suite 4: Clamp — right media bound ───────────────────────────────────────

describe('RollTrimTool — clamp: right media bound (E leftward)', () => {
  it('cannot roll left past right clip mediaIn=0 (constraint E)', () => {
    // RIGHT: mediaIn=50, mediaOut=250 → constraint E: origBoundary - 50 = 150
    // Rolling to frame 50 → clamped to 150 (by constraint E)
    // LEFT: same as default, intrinsicDuration=1000 → constraint B' not binding at 150
    // LEFT: [0,200), mediaIn=0, mediaOut=200; intrinsicDuration=1000
    // RIGHT: [200,400), mediaIn=50, mediaOut=250 (duration=200 to satisfy invariant)
    const clipLeft = createClip({
      id: 'clip-left', assetId: 'asset-1', trackId: 'track-1',
      timelineStart: toFrame(0), timelineEnd: toFrame(200),
      mediaIn: toFrame(0), mediaOut: toFrame(200),
    });
    const clipRight = createClip({
      id: 'clip-right', assetId: 'asset-1', trackId: 'track-1',
      timelineStart: toFrame(200), timelineEnd: toFrame(400),
      mediaIn: toFrame(50), mediaOut: toFrame(250),  // duration=200, mediaIn=50
    });
    const track = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [clipLeft, clipRight] });
    const tl    = createTimeline({ id: 'tl', name: 'T', fps: frameRate(30), duration: toFrame(9000), startTimecode: toTimecode('00:00:00:00'), tracks: [track] });
    const state = createTimelineState({ timeline: tl, assetRegistry: new Map([[ASSET_ID, makeAsset()]]) });

    const tool = new RollTrimTool();
    const ctx  = makeCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(200) }), ctx);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(50) }), ctx);

    expect(tx).not.toBeNull();
    const op0 = tx!.operations[0]!;
    // minBoundary = max(0+1=1, 200-50=150) = 150  ← E is binding here
    if (op0.type === 'RESIZE_CLIP') expect(op0.newFrame).toBe(toFrame(150));

    applyAndCheck(state, tx);
  });
});

// ── Suite 5: Clamp — min duration ─────────────────────────────────────────────

describe('RollTrimTool — clamp: min-duration (1 frame)', () => {
  it('left clip cannot be rolled to 0 frames — clamped to frame 1 (constraint A)', () => {
    // LEFT: timelineStart=0 → minBoundary from A = 0+1 = 1
    // Constraint E: origBoundary - rightMediaIn = 200 - 199 = 1 (matches A exactly)
    // Rolling to frame 0 → clamped to 1
    // RIGHT: mediaIn=199, mediaOut=399 (duration=200 satisfies invariant)
    const clipLeft = createClip({
      id: 'clip-left', assetId: 'asset-1', trackId: 'track-1',
      timelineStart: toFrame(0), timelineEnd: toFrame(200),
      mediaIn: toFrame(0), mediaOut: toFrame(200),
    });
    const clipRight = createClip({
      id: 'clip-right', assetId: 'asset-1', trackId: 'track-1',
      timelineStart: toFrame(200), timelineEnd: toFrame(400),
      mediaIn: toFrame(199), mediaOut: toFrame(399),  // mediaIn=199 → E: 200-199=1 = A
    });
    const track = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [clipLeft, clipRight] });
    const tl    = createTimeline({ id: 'tl', name: 'T', fps: frameRate(30), duration: toFrame(9000), startTimecode: toTimecode('00:00:00:00'), tracks: [track] });
    const state = createTimelineState({ timeline: tl, assetRegistry: new Map([[ASSET_ID, makeAsset()]]) });

    const tool = new RollTrimTool();
    const ctx  = makeCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(200) }), ctx);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(0) }), ctx);

    expect(tx).not.toBeNull();
    const op0 = tx!.operations[0]!;
    if (op0.type === 'RESIZE_CLIP') expect(op0.newFrame).toBe(toFrame(1));

    applyAndCheck(state, tx);
  });

  it('right clip cannot be rolled to 0 frames — clamped at rightEnd - 1', () => {
    // RIGHT: timelineEnd=400. Max boundary = 400 - 1 = 399
    // Rolling to frame 9000 → clamped to 399
    const state = makeState();
    const tool  = new RollTrimTool();
    grabCut(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(9000) }), ctx);

    expect(tx).not.toBeNull();
    const op0 = tx!.operations[0]!;
    if (op0.type === 'RESIZE_CLIP') expect(op0.newFrame).toBe(toFrame(399));

    applyAndCheck(state, tx);
  });
});

// ── Suite 6: No-op ────────────────────────────────────────────────────────────

describe('RollTrimTool — no-op: pointerUp at original boundary', () => {
  it('returns null when released at frame 200 (original boundary)', () => {
    const state = makeState();
    const tool  = new RollTrimTool();
    grabCut(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(200) }), ctx);
    expect(tx).toBeNull();
  });
});

// ── Suite 7: No roll target (gap between clips) ───────────────────────────────

describe('RollTrimTool — no roll target: gap between clips', () => {
  it('gap=50: clicking frame 200 does not activate roll → null on pointerUp', () => {
    const state = makeState({ gap: 50 });   // RIGHT starts at 250, not 200
    const tool  = new RollTrimTool();
    const ctx   = makeCtx(state);

    // Frame 200 is within zone of leftClip.timelineEnd=200, but rightClip.timelineStart=250 ≠ 200
    tool.onPointerDown(makeEv({ frame: toFrame(200) }), ctx);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(250) }), ctx);
    expect(tx).toBeNull();
  });
});

// ── Suite 8: No roll target (single clip edge only) ───────────────────────────

describe('RollTrimTool — no roll target: only one clip edge nearby', () => {
  it('clicking frame 50 (inside left clip, no cut) → null', () => {
    const state = makeState();
    const tool  = new RollTrimTool();
    const ctx   = makeCtx(state);

    // Frame 50 — no clip has its end or start near here (left ends at 200, right starts at 200)
    tool.onPointerDown(makeEv({ frame: toFrame(50) }), ctx);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(150) }), ctx);
    expect(tx).toBeNull();
  });
});

// ── Suite 9: minBoundary > maxBoundary (no room to roll) ─────────────────────

describe('RollTrimTool — no-op: minBoundary > maxBoundary', () => {
  it('when both clips are at their media limits, onPointerDown is a no-op', () => {
    // LEFT: mediaIn=199, mediaOut=200 (only 1 frame of media on left side)
    //   min = max(0+1, 200-(200-199-1)) = max(1, 200-0) = max(1, 200) = 200
    // RIGHT: mediaIn=0, mediaOut=1 (only 1 frame of media on right side)
    //   max = min(400-1, 200+(1-0-1)) = min(399, 200) = 200
    // minBoundary=200, maxBoundary=200 → still equal (just barely valid)
    // Let's make it tighter:
    // LEFT: mediaIn=200, mediaOut=200 → range 0, making mediaOut-mediaIn-1 = -1
    //   min = max(1, 200-(-1)) = max(1, 201) = 201
    // RIGHT: mediaIn=0, mediaOut=1 → max = min(399, 200+0) = 200
    // minBoundary=201 > maxBoundary=200 → no-op ✓
    const state = makeState({ leftMediaIn: 200, leftMediaOut: 200, rightMediaIn: 0, rightMediaOut: 1 });
    const tool  = new RollTrimTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ frame: toFrame(200) }), ctx);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(190) }), ctx);
    expect(tx).toBeNull();
  });
});

// ── Suite 10: ProvisionalState ghost ─────────────────────────────────────────

describe('RollTrimTool — ProvisionalState ghost', () => {
  it('ghost has exactly 2 clips — left and right', () => {
    const state = makeState();
    const tool  = new RollTrimTool();
    grabCut(tool, state);
    const ctx   = makeCtx(state);

    const ghost = tool.onPointerMove(makeEv({ frame: toFrame(250) }), ctx);
    expect(ghost).not.toBeNull();
    expect(ghost!.isProvisional).toBe(true);
    expect(ghost!.clips).toHaveLength(2);
  });

  it('ghost left clip has new timelineEnd, right clip has new timelineStart = same frame', () => {
    const state = makeState();
    const tool  = new RollTrimTool();
    grabCut(tool, state);
    const ctx   = makeCtx(state);

    const ghost = tool.onPointerMove(makeEv({ frame: toFrame(250) }), ctx);
    const ghostLeft  = ghost!.clips.find(c => c.id === LEFT_ID)!;
    const ghostRight = ghost!.clips.find(c => c.id === RIGHT_ID)!;

    expect(ghostLeft.timelineEnd).toBe(toFrame(250));
    expect(ghostRight.timelineStart).toBe(toFrame(250));
    expect(ghostLeft.timelineEnd).toBe(ghostRight.timelineStart);  // always equal
  });

  it('not mid-drag → onPointerMove returns null', () => {
    const state = makeState();
    const tool  = new RollTrimTool();
    const ctx   = makeCtx(state);

    // No pointerDown
    const ghost = tool.onPointerMove(makeEv({ frame: toFrame(250) }), ctx);
    expect(ghost).toBeNull();
  });
});

// ── Suite 11: onCancel and structural ────────────────────────────────────────

describe('RollTrimTool — onCancel and structural', () => {
  it('onCancel resets state — subsequent pointerUp returns null', () => {
    const state = makeState();
    const tool  = new RollTrimTool();
    grabCut(tool, state);
    tool.onCancel();
    const ctx = makeCtx(state);
    const tx  = tool.onPointerUp(makeEv({ frame: toFrame(250) }), ctx);
    expect(tx).toBeNull();
  });

  it('getCursor returns ew-resize when mid-drag', () => {
    const state = makeState();
    const tool  = new RollTrimTool();
    grabCut(tool, state);
    const ctx = makeCtx(state);
    expect(tool.getCursor(ctx)).toBe('ew-resize');
  });

  it('getCursor returns default when idle', () => {
    const state = makeState();
    const tool  = new RollTrimTool();
    const ctx   = makeCtx(state);
    expect(tool.getCursor(ctx)).toBe('default');
  });

  it('has correct id and shortcutKey', () => {
    const tool = new RollTrimTool();
    expect(tool.id).toBe('roll-trim');
    expect(tool.shortcutKey).toBe('t');
  });
});
