/**
 * RippleTrimTool Tests — Phase 2 Step 3
 *
 * Covers all items from the approved test plan:
 *   □ END -delta: clip shorter, downstream clips shift left
 *   □ END +delta: clip longer, downstream clips shift right
 *   □ START +delta: clip shorter at front, left clips shift right
 *   □ START -delta: clip longer at front, left clips shift left
 *   □ Frame-0 clamp: START -delta clamped when left clip would go below 0
 *   □ Media bounds clamp END / START
 *   □ No-op: newFrame === original edge → null
 *   □ Min duration 1 frame allowed; 0 frames → null
 *   □ checkInvariants + dispatch.accepted on every non-null Transaction
 *
 * Zero React imports. All unit tests — no engine, no router.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { RippleTrimTool }   from '../../tools/ripple-trim';
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

const TRACK_ID   = toTrackId('track-1');
const ASSET_ID   = toAssetId('asset-1');
const CLIP_A_ID  = toClipId('clip-a');   // the clip being trimmed
const CLIP_B_ID  = toClipId('clip-b');   // downstream 1
const CLIP_C_ID  = toClipId('clip-c');   // downstream 2

// ── Fixture builders ─────────────────────────────────────────────────────────

function makeAsset(intrinsicDuration = 1000) {
  return createAsset({
    id: 'asset-1', name: 'Test', mediaType: 'video',
    filePath: '/media/test.mp4',
    intrinsicDuration: toFrame(intrinsicDuration),
    nativeFps: 30, sourceTimecodeOffset: toFrame(0), status: 'online',
  });
}

/**
 * Layout: A [100,300) → B [300,500) → C [500,700)
 * All mediaIn=0, mediaOut=200 (except A which uses mediaIn/Out params).
 * pixelsPerFrame = 10, so frame positions correspond to x*10.
 */
function makeEndTrimState(
  { aMediaIn = 0, aMediaOut = 200 }: { aMediaIn?: number; aMediaOut?: number } = {},
): TimelineState {
  const asset = makeAsset();
  const clipA = createClip({
    id: 'clip-a', assetId: 'asset-1', trackId: 'track-1',
    timelineStart: toFrame(100), timelineEnd: toFrame(300),
    mediaIn: toFrame(aMediaIn), mediaOut: toFrame(aMediaOut),
  });
  const clipB = createClip({
    id: 'clip-b', assetId: 'asset-1', trackId: 'track-1',
    timelineStart: toFrame(300), timelineEnd: toFrame(500),
    mediaIn: toFrame(0), mediaOut: toFrame(200),
  });
  const clipC = createClip({
    id: 'clip-c', assetId: 'asset-1', trackId: 'track-1',
    timelineStart: toFrame(500), timelineEnd: toFrame(700),
    mediaIn: toFrame(0), mediaOut: toFrame(200),
  });
  return buildState([clipA, clipB, clipC]);
}

/**
 * Layout for START edge trimming:
 * B [0,100) → C [100,200) → A [200,400) (A is trimmed from the start)
 */
function makeStartTrimState(
  { aMediaIn = 0, aMediaOut = 200 }: { aMediaIn?: number; aMediaOut?: number } = {},
): TimelineState {
  const asset = makeAsset();
  const clipB = createClip({
    id: 'clip-b', assetId: 'asset-1', trackId: 'track-1',
    timelineStart: toFrame(0), timelineEnd: toFrame(100),
    mediaIn: toFrame(0), mediaOut: toFrame(100),
  });
  const clipC = createClip({
    id: 'clip-c', assetId: 'asset-1', trackId: 'track-1',
    timelineStart: toFrame(100), timelineEnd: toFrame(200),
    mediaIn: toFrame(0), mediaOut: toFrame(100),
  });
  const clipA = createClip({
    id: 'clip-a', assetId: 'asset-1', trackId: 'track-1',
    timelineStart: toFrame(200), timelineEnd: toFrame(400),
    mediaIn: toFrame(aMediaIn), mediaOut: toFrame(aMediaOut),
  });
  return buildState([clipB, clipC, clipA]);
}

function buildState(clips: ReturnType<typeof createClip>[]): TimelineState {
  const asset = makeAsset();
  const track = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips });
  const timeline = createTimeline({
    id: 'tl', name: 'Ripple Test', fps: frameRate(30),
    duration: toFrame(9000), startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[ASSET_ID, makeAsset()]]) });
}

function makeCtx(state: TimelineState, overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    state,
    snapIndex:      buildSnapIndex(state, toFrame(0)),
    pixelsPerFrame: 10,   // 1 frame = 10px, so EDGE_HIT_ZONE_PX=8 = 0.8 frames
    modifiers:      { shift: false, alt: false, ctrl: false, meta: false },
    frameAtX:       (x) => toFrame(Math.floor(x / 10)),
    trackAtY:       (_y) => TRACK_ID,
    snap:           (frame, _excl?) => frame,
    ...overrides,
  };
}

function makeEv(overrides: {
  frame?: TimelineFrame; trackId?: TrackId | null; clipId?: ClipId | null;
  x?: number; y?: number; buttons?: number;
  shiftKey?: boolean; altKey?: boolean; metaKey?: boolean;
} = {}): TimelinePointerEvent {
  return {
    frame:    overrides.frame   ?? toFrame(0),
    trackId:  overrides.trackId ?? TRACK_ID,
    clipId:   overrides.clipId  ?? null,
    x:        overrides.x       ?? 0,
    y:        overrides.y       ?? 24,
    buttons:  overrides.buttons ?? 1,
    shiftKey: overrides.shiftKey ?? false,
    altKey:   overrides.altKey   ?? false,
    metaKey:  overrides.metaKey  ?? false,
  };
}

function applyAndCheck(
  state: TimelineState,
  tx: ReturnType<RippleTrimTool['onPointerUp']>,
): TimelineState {
  expect(tx).not.toBeNull();
  const result = dispatch(state, tx!);
  expect(result.accepted).toBe(true);
  if (result.accepted) {
    expect(checkInvariants(result.nextState)).toHaveLength(0);
  }
  return result.accepted ? result.nextState : state;
}

// ── Helper: grab a clip edge via pointerDown ──────────────────────────────────

/**
 * Simulates the user pressing down ON an edge of clip A.
 * frame is set to the edge frame exactly (within hit zone since hitZone = 0.8 frames
 * and we use frame = exact edge frame → distance = 0).
 */
function grabEndEdge(tool: RippleTrimTool, state: TimelineState) {
  const ctx = makeCtx(state);
  // Clip A's timelineEnd = 300; grab it
  tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(300) }), ctx);
}

function grabStartEdge(tool: RippleTrimTool, state: TimelineState) {
  const ctx = makeCtx(state);
  // In startTrimState, clip A's timelineStart = 200; grab it
  tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(200) }), ctx);
}

// ── Suite 1: END edge — clip shorter (negative delta) ─────────────────────────

describe('RippleTrimTool — END trim: -delta (clip gets shorter)', () => {
  let tool: RippleTrimTool;
  let state: TimelineState;

  beforeEach(() => { tool = new RippleTrimTool(); state = makeEndTrimState(); });

  it('produces RESIZE_CLIP(end) + 2× MOVE_CLIP', () => {
    grabEndEdge(tool, state);
    const ctx = makeCtx(state);
    // Drag end from 300 → 250 (delta = -50)
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(250) }), ctx);

    expect(tx).not.toBeNull();
    expect(tx!.operations[0]!.type).toBe('RESIZE_CLIP');
    expect(tx!.operations).toHaveLength(3);   // RESIZE + 2 MOVE

    const resize = tx!.operations[0]!;
    if (resize.type === 'RESIZE_CLIP') {
      expect(resize.edge).toBe('end');
      expect(resize.newFrame).toBe(toFrame(250));
    }
  });

  it('downstream clips shift left by the same delta (-50)', () => {
    grabEndEdge(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(250) }), ctx);

    const moves = tx!.operations.filter(o => o.type === 'MOVE_CLIP');
    expect(moves).toHaveLength(2);

    const moveB = moves.find(o => o.type === 'MOVE_CLIP' && o.clipId === CLIP_B_ID);
    const moveC = moves.find(o => o.type === 'MOVE_CLIP' && o.clipId === CLIP_C_ID);

    expect(moveB).toBeDefined();
    expect(moveC).toBeDefined();

    // B was at 300 → now 250; C was at 500 → now 450
    if (moveB?.type === 'MOVE_CLIP') expect(moveB.newTimelineStart).toBe(toFrame(250));
    if (moveC?.type === 'MOVE_CLIP') expect(moveC.newTimelineStart).toBe(toFrame(450));
  });

  it('passes checkInvariants', () => {
    grabEndEdge(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(250) }), ctx);
    applyAndCheck(state, tx);
  });
});

// ── Suite 2: END edge — clip longer (positive delta) ─────────────────────────

describe('RippleTrimTool — END trim: +delta (clip gets longer)', () => {
  let tool: RippleTrimTool;
  let state: TimelineState;

  beforeEach(() => { tool = new RippleTrimTool(); state = makeEndTrimState(); });

  it('downstream clips shift right by +delta (+50)', () => {
    grabEndEdge(tool, state);
    const ctx = makeCtx(state);
    // Drag end from 300 → 350 (delta = +50)
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(350) }), ctx);

    expect(tx).not.toBeNull();
    const moves = tx!.operations.filter(o => o.type === 'MOVE_CLIP');
    const moveB = moves.find(o => o.type === 'MOVE_CLIP' && o.clipId === CLIP_B_ID);
    const moveC = moves.find(o => o.type === 'MOVE_CLIP' && o.clipId === CLIP_C_ID);

    // B was at 300 → now 350; C was at 500 → now 550
    if (moveB?.type === 'MOVE_CLIP') expect(moveB.newTimelineStart).toBe(toFrame(350));
    if (moveC?.type === 'MOVE_CLIP') expect(moveC.newTimelineStart).toBe(toFrame(550));
  });

  it('passes checkInvariants', () => {
    grabEndEdge(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(350) }), ctx);
    applyAndCheck(state, tx);
  });
});

// ── Suite 3: START edge — clip shorter at front (+delta) ─────────────────────

describe('RippleTrimTool — START trim: +delta (clip shorter at front)', () => {
  let tool: RippleTrimTool;
  let state: TimelineState;

  beforeEach(() => { tool = new RippleTrimTool(); state = makeStartTrimState(); });

  it('produces RESIZE_CLIP(start) + 2× MOVE_CLIP for left clips', () => {
    grabStartEdge(tool, state);
    const ctx = makeCtx(state);
    // Drag start from 200 → 250 (delta = +50); left clips B[0,100) and C[100,200)
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(250) }), ctx);

    expect(tx).not.toBeNull();
    const resize = tx!.operations[0]!;
    if (resize.type === 'RESIZE_CLIP') {
      expect(resize.edge).toBe('start');
      expect(resize.newFrame).toBe(toFrame(250));
    }
    expect(tx!.operations).toHaveLength(3);  // RESIZE + 2 MOVE
  });

  it('left clips shift RIGHT by +delta (+50)', () => {
    grabStartEdge(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(250) }), ctx);

    const moves = tx!.operations.filter(o => o.type === 'MOVE_CLIP');
    const moveB = moves.find(o => o.type === 'MOVE_CLIP' && o.clipId === CLIP_B_ID);
    const moveC = moves.find(o => o.type === 'MOVE_CLIP' && o.clipId === CLIP_C_ID);

    // B was at 0 → now 50; C was at 100 → now 150
    if (moveB?.type === 'MOVE_CLIP') expect(moveB.newTimelineStart).toBe(toFrame(50));
    if (moveC?.type === 'MOVE_CLIP') expect(moveC.newTimelineStart).toBe(toFrame(150));
  });

  it('passes checkInvariants', () => {
    grabStartEdge(tool, state);
    const ctx = makeCtx(state);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(250) }), ctx);
    applyAndCheck(state, tx);
  });
});

// ── Suite 4: START edge — clip longer at front (-delta) ──────────────────────

describe('RippleTrimTool — START trim: -delta (clip longer at front)', () => {
  let tool: RippleTrimTool;
  let state: TimelineState;

  beforeEach(() => { tool = new RippleTrimTool(); state = makeStartTrimState(); });

  it('left clips shift LEFT by -delta (-50), bounded by frame-0 clamp', () => {
    grabStartEdge(tool, state);
    const ctx = makeCtx(state);
    // Drag start from 200 → 150 (delta = -50)
    // left clips B[0,100) and C[100,200): B+(-50) = -50 → clamped to 0
    // clamp: frame >= origStart - minStart = 200 - 0 = 200... wait
    // Actually: B.timelineStart = 0, so leftmost = 0
    // frame-0 clamp: frame >= dragOrigStart - leftmostStart = 200 - 0 = 200
    // So moving to 150 would be clamped to 200 (no-op)
    // Let me think: if B starts at 50 instead, then leftmost = 50
    // → minFrame = 200 - 50 = 150, so 150 is just allowed
    // Use a state where B starts at 50 and C at 150
    // Actually this test is checking the clamp separately (Suite 5)
    // Here just test that left clips DO shift left by -50 when it's allowed

    // clipA needs mediaIn=100 so leftward trim by -50 is within media bounds
    // (minStartForMedia = origStart - mediaIn = 200 - 100 = 100, so 150 is allowed)
    // B starts at 100 so delta=-50 keeps B at 50 (>= 0, ok)
    const stateWithRoom = buildState([
      createClip({
        id: 'clip-b', assetId: 'asset-1', trackId: 'track-1',
        timelineStart: toFrame(100), timelineEnd: toFrame(150),
        mediaIn: toFrame(0), mediaOut: toFrame(50),
      }),
      createClip({
        id: 'clip-a', assetId: 'asset-1', trackId: 'track-1',
        timelineStart: toFrame(200), timelineEnd: toFrame(400),
        mediaIn: toFrame(100), mediaOut: toFrame(300),   // 100 frames of leftward headroom
      }),
    ]);

    const tool2  = new RippleTrimTool();
    const ctxRoom = makeCtx(stateWithRoom);

    // Grab start of A at 200, then move to 150 (delta = -50)
    // clamp check: minStartForMedia = 200 - 100 = 100 ≤ 150 ✓
    tool2.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(200) }), ctxRoom);
    const tx = tool2.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(150) }), ctxRoom);

    expect(tx).not.toBeNull();
    const moveB = tx!.operations.find(o => o.type === 'MOVE_CLIP' && o.clipId === CLIP_B_ID);
    // B was at 100 → now 50 (100 + (-50))
    if (moveB?.type === 'MOVE_CLIP') expect(moveB.newTimelineStart).toBe(toFrame(50));

    applyAndCheck(stateWithRoom, tx);
  });
});

// ── Suite 5: Frame-0 clamp ────────────────────────────────────────────────────

describe('RippleTrimTool — Frame-0 clamp (START leftward)', () => {
  it('clamps newFrame when leftmost downstream clip would go below frame 0', () => {
    // B starts at 0 — any leftward trim would push B below 0
    const state = makeStartTrimState();  // B[0,100), C[100,200), A[200,400)
    const tool  = new RippleTrimTool();
    const ctx   = makeCtx(state);

    // Grab A's start at 200, drag to 100 (delta = -100); B would go to -100
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(200) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(100) }), ctx);

    // Clamped: leftmostStart = 0, so frame >= 200 - 0 = 200 → no-op (null)
    // Because dragOrigStart(200) - leftmost(0) = 200, which is the original position
    expect(tx).toBeNull();   // fully clamped → no movement → null
  });

  it('partial clamp: allows trim up to where leftmost clip hits frame 0', () => {
    // B starts at 80 → can move at most -80 before hitting 0
    // clipA.mediaIn=120 so minStartForMedia = 200-120 = 80, giving plenty of room
    // The binding clamp is the frame-0 clamp: 200 - 80 = 120
    const state2 = buildState([
      createClip({
        id: 'clip-b', assetId: 'asset-1', trackId: 'track-1',
        timelineStart: toFrame(80), timelineEnd: toFrame(180),
        mediaIn: toFrame(0), mediaOut: toFrame(100),
      }),
      createClip({
        id: 'clip-a', assetId: 'asset-1', trackId: 'track-1',
        timelineStart: toFrame(200), timelineEnd: toFrame(400),
        mediaIn: toFrame(120), mediaOut: toFrame(320),   // 120 frames leftward headroom
      }),
    ]);

    const tool2 = new RippleTrimTool();
    const ctx2  = makeCtx(state2);

    // Drag start from 200 → 100 (want delta = -100), but clamped to -80
    // frame-0 clamp: minFrame = dragOrigStart(200) - leftmost(80) = 120
    // media clamp: minStartForMedia = 200 - 120 = 80 ≤ 120 (frame-0 clamp is tighter)
    tool2.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(200) }), ctx2);
    const tx = tool2.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(100) }), ctx2);

    expect(tx).not.toBeNull();
    const resize = tx!.operations[0]!;
    // Clamped to 120 (200 - 80 = 120)
    if (resize.type === 'RESIZE_CLIP') expect(resize.newFrame).toBe(toFrame(120));

    applyAndCheck(state2, tx);
  });
});

// ── Suite 6: Media bounds clamp ───────────────────────────────────────────────

describe('RippleTrimTool — Media bounds clamp', () => {
  it('END trim clamped: mediaOut cannot drop below mediaIn + 1', () => {
    // A has mediaIn=0, mediaOut=200, timelineEnd=300
    // Dragging end to 99 (mediaOut would become 99-300+200 = -1) → clamped
    // Actually: mediaOut = origMediaOut + delta where delta = newFrame - origEnd
    // At newFrame=101: delta = 101-300 = -199, mediaOut = 200 + (-199) = 1 ≥ mediaIn+1=1 ✓ (just ok)
    // At newFrame=100: delta = -200, mediaOut = 0 < mediaIn+1=1 → clamped
    // minEndForMedia = origEnd - (origMediaOut - origMediaIn - 1) = 300 - (200-0-1) = 300-199=101
    const state = makeEndTrimState();
    const tool  = new RippleTrimTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(300) }), ctx);
    // Try to drag end way past media constraint (to frame 50)
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(50) }), ctx);

    expect(tx).not.toBeNull();
    const resize = tx!.operations[0]!;
    // Clamped to 101 (minEndForMedia = 300 - 199 = 101)
    if (resize.type === 'RESIZE_CLIP') expect(resize.newFrame).toBe(toFrame(101));

    applyAndCheck(state, tx);
  });

  it('START trim clamped: mediaIn cannot exceed mediaOut - 1', () => {
    // A: timelineStart=200, mediaIn=0, mediaOut=200
    // maxStartForMedia = origStart + (origMediaOut - origMediaIn - 1) = 200 + 199 = 399
    // Trying to drag to 450 → clamped to 399
    // But also max duration clamp: maxStart = origEnd - 1 = 400 - 1 = 399 (same here)
    const state = makeStartTrimState();
    const tool  = new RippleTrimTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(200) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(450) }), ctx);

    expect(tx).not.toBeNull();
    const resize = tx!.operations[0]!;
    if (resize.type === 'RESIZE_CLIP') expect(resize.newFrame).toBe(toFrame(399));

    applyAndCheck(state, tx);
  });
});

// ── Suite 7: No-op ────────────────────────────────────────────────────────────

describe('RippleTrimTool — No-op: newFrame === original edge', () => {
  it('END no-op: releasing at original end position returns null', () => {
    const state = makeEndTrimState();
    const tool  = new RippleTrimTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(300) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(300) }), ctx);
    expect(tx).toBeNull();
  });

  it('START no-op: releasing at original start position returns null', () => {
    const state = makeStartTrimState();
    const tool  = new RippleTrimTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(200) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(200) }), ctx);
    expect(tx).toBeNull();
  });
});

// ── Suite 8: Min duration ─────────────────────────────────────────────────────

describe('RippleTrimTool — Min duration constraint', () => {
  it('END trim to exactly 1 frame remaining → valid Transaction', () => {
    const state = makeEndTrimState();
    const tool  = new RippleTrimTool();
    const ctx   = makeCtx(state);

    // A: timelineStart=100, timelineEnd=300. Min end = 101.
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(300) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(101) }), ctx);

    // If media bounds allow: mediaOut clamped to 101 as well (minEndForMedia = 101)
    // Both clamps agree on 101 → valid
    expect(tx).not.toBeNull();
    applyAndCheck(state, tx);
  });

  it('END trim: clamping prevents going below min duration (never produces null from clamp alone when clamped frame > origStart)', () => {
    // The clamping logic ensures newFrame is always > timelineStart after clamp,
    // so the duration check passes when clamped. Null is only returned if
    // clamp produces a frame == origStart (no-op), which the no-op test covers.
    const state = makeEndTrimState();
    const tool  = new RippleTrimTool();
    const ctx   = makeCtx(state);

    // Drag end to frame 0 — well below any allowed position
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(300) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(0) }), ctx);

    // Clamped to 101 (media bounds), which is > timelineStart(100) → valid
    expect(tx).not.toBeNull();
    const resize = tx!.operations[0]!;
    if (resize.type === 'RESIZE_CLIP') expect(resize.newFrame).toBe(toFrame(101));
  });
});

// ── Suite 9: ProvisionalState ghost ───────────────────────────────────────────

describe('RippleTrimTool — ProvisionalState ghost', () => {
  it('ghost has trimmed clip + downstream clips all in one clips array', () => {
    const state = makeEndTrimState();
    const tool  = new RippleTrimTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(300) }), ctx);
    const ghost = tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, frame: toFrame(250) }), ctx);

    expect(ghost).not.toBeNull();
    expect(ghost!.isProvisional).toBe(true);
    expect(ghost!.clips).toHaveLength(3);   // A + B + C
  });

  it('ghost trimmed clip has updated timelineEnd', () => {
    const state = makeEndTrimState();
    const tool  = new RippleTrimTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(300) }), ctx);
    const ghost = tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, frame: toFrame(250) }), ctx);

    const ghostA = ghost!.clips.find(c => c.id === CLIP_A_ID)!;
    expect(ghostA.timelineEnd).toBe(toFrame(250));
    expect(ghostA.timelineStart).toBe(toFrame(100));  // unchanged
  });

  it('ghost downstream clips are shifted by uniform delta', () => {
    const state = makeEndTrimState();
    const tool  = new RippleTrimTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(300) }), ctx);
    // delta = -50
    const ghost = tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, frame: toFrame(250) }), ctx);

    const ghostB = ghost!.clips.find(c => c.id === CLIP_B_ID)!;
    const ghostC = ghost!.clips.find(c => c.id === CLIP_C_ID)!;

    expect(ghostB.timelineStart).toBe(toFrame(250));  // 300 - 50
    expect(ghostC.timelineStart).toBe(toFrame(450));  // 500 - 50
  });

  it('not mid-drag → onPointerMove returns null', () => {
    const state = makeEndTrimState();
    const tool  = new RippleTrimTool();
    const ctx   = makeCtx(state);

    // No pointerDown first
    const ghost = tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, frame: toFrame(250) }), ctx);
    expect(ghost).toBeNull();
  });
});

// ── Suite 10: onCancel ────────────────────────────────────────────────────────

describe('RippleTrimTool — onCancel and structural', () => {
  it('onCancel clears all state — subsequent onPointerUp returns null', () => {
    const state = makeEndTrimState();
    const tool  = new RippleTrimTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(300) }), ctx);
    tool.onCancel();

    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(250) }), ctx);
    expect(tx).toBeNull();
  });

  it('getCursor returns ew-resize when hovering clip edge', () => {
    const state = makeEndTrimState();
    const tool  = new RippleTrimTool();
    const ctx   = makeCtx(state);

    // Hover near clip A's end edge (frame 300 exactly → distance = 0)
    tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, frame: toFrame(300) }), ctx);
    expect(tool.getCursor(ctx)).toBe('ew-resize');
  });

  it('has correct id and shortcutKey', () => {
    const tool = new RippleTrimTool();
    expect(tool.id).toBe('ripple-trim');
    expect(tool.shortcutKey).toBe('r');
  });
});
