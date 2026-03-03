/**
 * RazorTool Tests — Phase 2 Step 2
 *
 * Covers all 7 items from the approved test plan:
 *   □ computeSlice at timelineStart → null
 *   □ computeSlice at timelineEnd   → null
 *   □ computeSlice strictly inside  → left.mediaOut === right.mediaIn
 *   □ Single click: DELETE + 2× INSERT, checkInvariants passes
 *   □ Shift+click 3 tracks: 9 ops in 1 Transaction, checkInvariants passes
 *   □ Shift+click with 2/3 tracks having clips at frame → only 2 sliced (6 ops)
 *   □ _setIdGenerator: left.id and right.id are distinct and deterministic
 *
 * Zero React imports. All tests are pure unit tests against RazorTool + dispatcher.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { RazorTool, _setIdGenerator } from '../../tools/razor';
import { checkInvariants }            from '../../validation/invariants';
import { dispatch }                   from '../../engine/dispatcher';
import { createTimelineState }        from '../../types/state';
import { createTimeline }             from '../../types/timeline';
import { createTrack, toTrackId }     from '../../types/track';
import { createClip, toClipId }       from '../../types/clip';
import { createAsset, toAssetId }     from '../../types/asset';
import { toFrame, toTimecode, frameRate } from '../../types/frame';
import { buildSnapIndex }             from '../../snap-index';
import type { ToolContext, TimelinePointerEvent } from '../../tools/types';
import type { TimelineState }  from '../../types/state';
import type { TimelineFrame }  from '../../types/frame';
import type { TrackId }        from '../../types/track';
import type { ClipId }         from '../../types/clip';

// ── ID generator hook (deterministic in tests) ─────────────────────────────

let idCounter = 0;

beforeEach(() => {
  idCounter = 0;
  _setIdGenerator(() => `test-id-${++idCounter}`);
});

afterEach(() => {
  _setIdGenerator(() => crypto.randomUUID());
});

// ── Fixtures ────────────────────────────────────────────────────────────────

const ASSET_ID = toAssetId('asset-1');
const T1_ID    = toTrackId('track-1');
const T2_ID    = toTrackId('track-2');
const T3_ID    = toTrackId('track-3');
const CLIP_A   = toClipId('clip-a');   // track-1, [0, 200)
const CLIP_B   = toClipId('clip-b');   // track-2, [100, 300)
const CLIP_C   = toClipId('clip-c');   // track-3, [0, 200)

function makeAsset() {
  return createAsset({
    id:                   'asset-1',
    name:                 'Test Asset',
    mediaType:            'video',
    filePath:             '/media/test.mp4',
    intrinsicDuration:    toFrame(600),
    nativeFps:            30,
    sourceTimecodeOffset: toFrame(0),
    status:               'online',
  });
}

/**
 * Build a 3-track state:
 *   track-1: clip-a [0, 200)
 *   track-2: clip-b [100, 300)  ← not aligned with t1/t3
 *   track-3: clip-c [0, 200)
 */
function makeState3Tracks(): TimelineState {
  const asset = makeAsset();

  const clipA = createClip({
    id: 'clip-a', assetId: 'asset-1', trackId: 'track-1',
    timelineStart: toFrame(0),   timelineEnd: toFrame(200),
    mediaIn: toFrame(0), mediaOut: toFrame(200),
  });
  const clipB = createClip({
    id: 'clip-b', assetId: 'asset-1', trackId: 'track-2',
    timelineStart: toFrame(100), timelineEnd: toFrame(300),
    mediaIn: toFrame(50), mediaOut: toFrame(250),   // deliberate offset
  });
  const clipC = createClip({
    id: 'clip-c', assetId: 'asset-1', trackId: 'track-3',
    timelineStart: toFrame(0),   timelineEnd: toFrame(200),
    mediaIn: toFrame(0), mediaOut: toFrame(200),
  });

  const t1 = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [clipA] });
  const t2 = createTrack({ id: 'track-2', name: 'V2', type: 'video', clips: [clipB] });
  const t3 = createTrack({ id: 'track-3', name: 'V3', type: 'video', clips: [clipC] });

  const timeline = createTimeline({
    id: 'tl', name: 'Razor Test',
    fps: frameRate(30), duration: toFrame(9000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [t1, t2, t3],
  });

  return createTimelineState({ timeline, assetRegistry: new Map([[ASSET_ID, asset]]) });
}

/** Minimal single-track state using clip-a [0,200) on track-1. */
function makeSingleTrackState(): TimelineState {
  const asset = makeAsset();
  const clipA = createClip({
    id: 'clip-a', assetId: 'asset-1', trackId: 'track-1',
    timelineStart: toFrame(0), timelineEnd: toFrame(200),
    mediaIn: toFrame(0), mediaOut: toFrame(200),
  });
  const t1 = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [clipA] });
  const timeline = createTimeline({
    id: 'tl', name: 'Razor Test',
    fps: frameRate(30), duration: toFrame(9000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [t1],
  });
  return createTimelineState({ timeline, assetRegistry: new Map([[ASSET_ID, asset]]) });
}

function makeCtx(
  state: TimelineState,
  overrides: Partial<ToolContext> = {},
): ToolContext {
  return {
    state,
    snapIndex:      buildSnapIndex(state, toFrame(0)),
    pixelsPerFrame: 10,
    modifiers:      { shift: false, alt: false, ctrl: false, meta: false },
    frameAtX:       (x) => toFrame(Math.floor(x / 10)),
    trackAtY:       (_y) => T1_ID,
    snap:           (frame, _exclude?) => frame,   // identity
    ...overrides,
  };
}

function makeEv(overrides: {
  frame?:    TimelineFrame;
  trackId?:  TrackId | null;
  clipId?:   ClipId  | null;
  x?: number; y?: number; buttons?: number;
  shiftKey?: boolean; altKey?: boolean; metaKey?: boolean;
} = {}): TimelinePointerEvent {
  return {
    frame:    overrides.frame   ?? toFrame(0),
    trackId:  overrides.trackId ?? T1_ID,
    clipId:   overrides.clipId  ?? null,
    x:        overrides.x       ?? 0,
    y:        overrides.y       ?? 24,
    buttons:  overrides.buttons ?? 1,
    shiftKey: overrides.shiftKey ?? false,
    altKey:   overrides.altKey   ?? false,
    metaKey:  overrides.metaKey  ?? false,
  };
}

/** Dispatch the transaction and assert zero invariant violations. */
function applyAndCheck(state: TimelineState, tx: ReturnType<RazorTool['onPointerUp']>) {
  expect(tx).not.toBeNull();
  const result = dispatch(state, tx!);
  expect(result.accepted).toBe(true);
  if (result.accepted) {
    expect(checkInvariants(result.nextState)).toHaveLength(0);
  }
  return result.accepted ? result.nextState : state;
}

// ── UNIT: computeSlice boundary guards ────────────────────────────────────
// computeSlice is private but exercised through the tool's end-to-end behavior

describe('RazorTool — computeSlice boundary guards (via onPointerUp)', () => {
  let tool: RazorTool;
  let state: TimelineState;

  beforeEach(() => {
    tool  = new RazorTool();
    state = makeSingleTrackState();
  });

  it('click exactly at timelineStart → no Transaction (would produce zero-duration left half)', () => {
    const ctx = makeCtx(state);
    // clip-a starts at frame 0
    tool.onPointerDown(makeEv({ clipId: CLIP_A, frame: toFrame(0) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A, frame: toFrame(0) }), ctx);
    expect(tx).toBeNull();
  });

  it('click exactly at timelineEnd → no Transaction (would produce zero-duration right half)', () => {
    const ctx = makeCtx(state);
    // clip-a ends at frame 200
    tool.onPointerDown(makeEv({ clipId: CLIP_A, frame: toFrame(200) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A, frame: toFrame(200) }), ctx);
    expect(tx).toBeNull();
  });

  it('click 1 frame before timelineEnd → valid Transaction + correct math', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A, frame: toFrame(199) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A, frame: toFrame(199) }), ctx);
    expect(tx).not.toBeNull();
    // left: [0,199), right: [199,200)
    const insertOps = tx!.operations.filter(o => o.type === 'INSERT_CLIP');
    expect(insertOps).toHaveLength(2);
    if (insertOps[0]!.type === 'INSERT_CLIP') {
      expect(insertOps[0]!.clip.timelineEnd).toBe(toFrame(199));
    }
    if (insertOps[1]!.type === 'INSERT_CLIP') {
      expect(insertOps[1]!.clip.timelineStart).toBe(toFrame(199));
    }
  });
});

// ── UNIT: computeSlice math ────────────────────────────────────────────────

describe('RazorTool — slice math (left.mediaOut === right.mediaIn)', () => {
  it('split point: left.mediaOut equals right.mediaIn', () => {
    const state = makeSingleTrackState();
    const tool  = new RazorTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: CLIP_A, frame: toFrame(80) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A, frame: toFrame(80) }), ctx);
    expect(tx).not.toBeNull();

    const inserts = tx!.operations.filter(o => o.type === 'INSERT_CLIP');
    expect(inserts).toHaveLength(2);

    const left  = (inserts[0] as { type: 'INSERT_CLIP'; clip: any }).clip;
    const right = (inserts[1] as { type: 'INSERT_CLIP'; clip: any }).clip;

    // Core slice invariant
    expect(left.mediaOut).toBe(right.mediaIn);
    // Timeline bounds
    expect(left.timelineEnd).toBe(toFrame(80));
    expect(right.timelineStart).toBe(toFrame(80));
    // Duration preservation
    const leftDuration  = left.timelineEnd  - left.timelineStart;
    const rightDuration = right.timelineEnd - right.timelineStart;
    expect(leftDuration + rightDuration).toBe(200);   // original was 200 frames
  });

  it('clip with non-zero mediaIn: offset correctly applied to mediaIn/mediaOut', () => {
    // clip-b: timelineStart=100, mediaIn=50 → at frame 150, offset=50
    // left.mediaOut = 50 + 50 = 100, right.mediaIn = 100
    const state = makeState3Tracks();
    const tool  = new RazorTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: CLIP_B, frame: toFrame(150) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_B, frame: toFrame(150) }), ctx);
    expect(tx).not.toBeNull();

    const inserts = tx!.operations.filter(o => o.type === 'INSERT_CLIP');
    const left    = (inserts[0] as { type: 'INSERT_CLIP'; clip: any }).clip;
    const right   = (inserts[1] as { type: 'INSERT_CLIP'; clip: any }).clip;

    expect(left.mediaIn).toBe(toFrame(50));    // original mediaIn preserved
    expect(left.mediaOut).toBe(toFrame(100));  // 50 + (150 - 100) = 100
    expect(right.mediaIn).toBe(toFrame(100));  // same value — the split point
    expect(right.mediaOut).toBe(toFrame(250)); // original mediaOut preserved
    expect(left.mediaOut).toBe(right.mediaIn); // invariant
  });
});

// ── INTEGRATION: single-clip slice ────────────────────────────────────────

describe('RazorTool — single clip slice (no shift)', () => {
  let tool:  RazorTool;
  let state: TimelineState;

  beforeEach(() => {
    tool  = new RazorTool();
    state = makeSingleTrackState();
  });

  it('produces DELETE_CLIP + 2× INSERT_CLIP', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A, frame: toFrame(100) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A, frame: toFrame(100) }), ctx);

    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(3);
    expect(tx!.operations[0]!.type).toBe('DELETE_CLIP');
    expect(tx!.operations[1]!.type).toBe('INSERT_CLIP');
    expect(tx!.operations[2]!.type).toBe('INSERT_CLIP');
  });

  it('DELETE_CLIP targets the original clipId', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A, frame: toFrame(100) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A, frame: toFrame(100) }), ctx);



    const del = tx!.operations[0]!;
    if (del.type === 'DELETE_CLIP') {
      expect(del.clipId).toBe(CLIP_A);
    }
  });

  it('passes checkInvariants after dispatch', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A, frame: toFrame(100) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A, frame: toFrame(100) }), ctx);
    applyAndCheck(state, tx);
  });

  it('after slice: track has exactly 2 clips with adjacent boundaries', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A, frame: toFrame(80) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A, frame: toFrame(80) }), ctx);
    const nextState = applyAndCheck(state, tx);

    const clips = nextState.timeline.tracks[0]!.clips;
    expect(clips).toHaveLength(2);
    expect(clips[0]!.timelineEnd).toBe(clips[1]!.timelineStart);  // adjacent, no gap
  });

  it('clicking empty space returns null', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: null, frame: toFrame(500) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: null, frame: toFrame(500) }), ctx);
    expect(tx).toBeNull();
  });
});

// ── INTEGRATION: shift+click all tracks ───────────────────────────────────

describe('RazorTool — shift+click: all tracks', () => {
  let tool:  RazorTool;
  let state: TimelineState;   // 3 tracks

  beforeEach(() => {
    tool  = new RazorTool();
    state = makeState3Tracks();
  });

  function shiftCtx(s: TimelineState): ToolContext {
    return makeCtx(s, {
      modifiers: { shift: true, alt: false, ctrl: false, meta: false },
    });
  }

  it('frame 150 → clips on all 3 tracks hit → 9 ops (DELETE+left+right per clip)', () => {
    // At frame 150: clip-a [0,200)✓  clip-b [100,300)✓  clip-c [0,200)✓
    const ctx = shiftCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(150) }), ctx);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(150) }), ctx);

    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(9);   // 3 clips × 3 ops each

    const deletes = tx!.operations.filter(o => o.type === 'DELETE_CLIP');
    const inserts = tx!.operations.filter(o => o.type === 'INSERT_CLIP');
    expect(deletes).toHaveLength(3);
    expect(inserts).toHaveLength(6);   // 2 per clip
  });

  it('shift+click 3 tracks passes checkInvariants', () => {
    const ctx = shiftCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(150) }), ctx);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(150) }), ctx);
    applyAndCheck(state, tx);
  });

  it('frame 50 → only track-1 and track-3 have clips → 6 ops (clip-b starts at 100)', () => {
    // At frame 50: clip-a [0,200)✓  clip-b [100,300)✗ (50 < 100)  clip-c [0,200)✓
    const ctx = shiftCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(50) }), ctx);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(50) }), ctx);

    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(6);   // only 2 clips sliced

    const deletes = tx!.operations.filter(o => o.type === 'DELETE_CLIP');
    expect(deletes).toHaveLength(2);
    // clip-b must NOT appear in any delete op
    const clipBDeleted = deletes.some(
      o => o.type === 'DELETE_CLIP' && o.clipId === CLIP_B,
    );
    expect(clipBDeleted).toBe(false);
  });

  it('frame where no clips exist → returns null', () => {
    // frame 9000 is beyond all clips
    const ctx = shiftCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(9000) }), ctx);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(9000) }), ctx);
    expect(tx).toBeNull();
  });

  it('per-clip grouping: ops ordered DELETE,left,right per clip (not all-deletes-first)', () => {
    const ctx = shiftCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(150) }), ctx);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(150) }), ctx);
    expect(tx).not.toBeNull();

    // Check pattern: ops should follow DELETE, INSERT, INSERT, DELETE, INSERT, INSERT, ...
    for (let i = 0; i < 9; i += 3) {
      expect(tx!.operations[i]!.type).toBe('DELETE_CLIP');
      expect(tx!.operations[i + 1]!.type).toBe('INSERT_CLIP');
      expect(tx!.operations[i + 2]!.type).toBe('INSERT_CLIP');
    }
  });
});

// ── _setIdGenerator: deterministic IDs ────────────────────────────────────

describe('RazorTool — _setIdGenerator: new ClipIds are distinct and deterministic', () => {
  it('left and right halves have distinct ids from _setIdGenerator', () => {
    // idCounter resets in global beforeEach — first two calls = 'test-id-1', 'test-id-2'
    const state = makeSingleTrackState();
    const tool  = new RazorTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: CLIP_A, frame: toFrame(100) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A, frame: toFrame(100) }), ctx);
    expect(tx).not.toBeNull();

    const inserts = tx!.operations.filter(o => o.type === 'INSERT_CLIP');
    const leftId  = (inserts[0] as { type: 'INSERT_CLIP'; clip: any }).clip.id;
    const rightId = (inserts[1] as { type: 'INSERT_CLIP'; clip: any }).clip.id;

    expect(leftId).toBe('test-id-1');
    expect(rightId).toBe('test-id-2');
    expect(leftId).not.toBe(rightId);
  });

  it('neither half reuses the original clip id', () => {
    const state = makeSingleTrackState();
    const tool  = new RazorTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: CLIP_A, frame: toFrame(100) }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A, frame: toFrame(100) }), ctx);

    const inserts = tx!.operations.filter(o => o.type === 'INSERT_CLIP');
    for (const op of inserts) {
      if (op.type === 'INSERT_CLIP') {
        expect(op.clip.id).not.toBe(CLIP_A);
      }
    }
  });
});

// ── onCancel / structural ─────────────────────────────────────────────────

describe('RazorTool — onCancel and structural', () => {
  it('getCursor always returns "crosshair"', () => {
    const state = makeSingleTrackState();
    const ctx   = makeCtx(state);
    const tool  = new RazorTool();
    expect(tool.getCursor(ctx)).toBe('crosshair');
  });

  it('onPointerMove always returns null', () => {
    const state = makeSingleTrackState();
    const ctx   = makeCtx(state);
    const tool  = new RazorTool();
    const result = tool.onPointerMove(makeEv({ clipId: CLIP_A, frame: toFrame(50) }), ctx);
    expect(result).toBeNull();
  });

  it('onCancel resets pending state — subsequent onPointerUp returns null', () => {
    const state = makeSingleTrackState();
    const ctx   = makeCtx(state);
    const tool  = new RazorTool();

    tool.onPointerDown(makeEv({ clipId: CLIP_A, frame: toFrame(100) }), ctx);
    tool.onCancel();
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A, frame: toFrame(100) }), ctx);
    expect(tx).toBeNull();
  });

  it('has correct id and shortcutKey', () => {
    const tool = new RazorTool();
    expect(tool.id).toBe('razor');
    expect(tool.shortcutKey).toBe('b');
  });
});
