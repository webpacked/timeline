/**
 * RippleDeleteTool Tests — Phase 2 Step 6
 *
 * Covers all items from the approved test plan:
 *   □ Single clip, no downstream: 1 op (DELETE_CLIP only)
 *   □ Single clip, 3 downstream: 4 ops in correct order
 *   □ MOVE_CLIP sort: leftmost downstream clip first in operations[]
 *   □ Each downstream clip shifts by exactly deletedDuration
 *   □ Click on empty space: null
 *   □ Clip missing from state at onPointerUp (defensive): null
 *   □ checkInvariants + dispatch.accepted on every Transaction
 *   □ operations[0].type === 'DELETE_CLIP' always (explicit on every test)
 *   □ No provisional state: onPointerMove always returns null
 *
 * Zero React imports.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { RippleDeleteTool }  from '../../tools/ripple-delete';
import { checkInvariants }   from '../../validation/invariants';
import { dispatch }          from '../../engine/dispatcher';
import { createTimelineState }  from '../../types/state';
import { createTimeline }    from '../../types/timeline';
import { createTrack, toTrackId } from '../../types/track';
import { createClip, toClipId }   from '../../types/clip';
import { createAsset, toAssetId } from '../../types/asset';
import { toFrame, toTimecode, frameRate } from '../../types/frame';
import { buildSnapIndex }    from '../../snap-index';
import type { ToolContext, TimelinePointerEvent } from '../../tools/types';
import type { TimelineState }   from '../../types/state';
import type { TimelineFrame }   from '../../types/frame';
import type { TrackId }         from '../../types/track';
import type { ClipId }          from '../../types/clip';

// ── Constants ─────────────────────────────────────────────────────────────────

const TRACK_ID   = toTrackId('track-1');
const ASSET_ID   = toAssetId('asset-1');
const TARGET_ID  = toClipId('clip-target');

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeAsset() {
  return createAsset({
    id: 'asset-1', name: 'Test', mediaType: 'video',
    filePath: '/media/test.mp4',
    intrinsicDuration: toFrame(9000),
    nativeFps: 30, sourceTimecodeOffset: toFrame(0), status: 'online',
  });
}

/**
 * Build a state with:
 *   targetClip = [100, 300)  → deletedDuration = 200
 *   downstream clips at positions provided by downstreamStarts[]
 *   each downstream clip is 100 frames long
 */
function makeState(downstreamStarts: number[] = []): TimelineState {
  const asset = makeAsset();
  const clips = [
    createClip({
      id: 'clip-target', assetId: 'asset-1', trackId: 'track-1',
      timelineStart: toFrame(100), timelineEnd: toFrame(300),
      mediaIn: toFrame(0), mediaOut: toFrame(200),
    }),
    ...downstreamStarts.map((start, i) =>
      createClip({
        id: `clip-ds-${i}`, assetId: 'asset-1', trackId: 'track-1',
        timelineStart: toFrame(start), timelineEnd: toFrame(start + 100),
        mediaIn: toFrame(i * 100), mediaOut: toFrame(i * 100 + 100),
      }),
    ),
  ];
  const track    = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips });
  const timeline = createTimeline({
    id: 'tl', name: 'RippleDelete Test', fps: frameRate(30),
    duration: toFrame(9000), startTimecode: toTimecode('00:00:00:00'), tracks: [track],
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
} = {}): TimelinePointerEvent {
  return {
    frame:    overrides.frame   ?? toFrame(0),
    trackId:  overrides.trackId ?? TRACK_ID,
    clipId:   overrides.clipId  ?? null,
    x: 0, y: 24, buttons: 1,
    shiftKey: false, altKey: false, metaKey: false,
  };
}

function clickTarget(tool: RippleDeleteTool, state: TimelineState): ReturnType<RippleDeleteTool['onPointerUp']> {
  const ctx = makeCtx(state);
  tool.onPointerDown(makeEv({ clipId: TARGET_ID, frame: toFrame(200) }), ctx);
  return tool.onPointerUp(makeEv({ clipId: TARGET_ID, frame: toFrame(200) }), ctx);
}

function applyAndCheck(state: TimelineState, tx: ReturnType<RippleDeleteTool['onPointerUp']>): TimelineState {
  expect(tx).not.toBeNull();
  const result = dispatch(state, tx!);
  expect(result.accepted).toBe(true);
  if (result.accepted) {
    expect(checkInvariants(result.nextState)).toHaveLength(0);
  }
  return result.accepted ? result.nextState : state;
}

// ── Suite 1: No downstream clips ─────────────────────────────────────────────

describe('RippleDeleteTool — no downstream: 1 op only', () => {
  let tool: RippleDeleteTool;
  let state: TimelineState;

  beforeEach(() => { tool = new RippleDeleteTool(); state = makeState(); });

  it('operations.length === 1', () => {
    const tx = clickTarget(tool, state);
    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(1);
  });

  it('operations[0].type === DELETE_CLIP (always first)', () => {
    const tx = clickTarget(tool, state);
    expect(tx!.operations[0]!.type).toBe('DELETE_CLIP');
    const op = tx!.operations[0]!;
    if (op.type === 'DELETE_CLIP') expect(op.clipId).toBe(TARGET_ID);
  });

  it('dispatch accepted + checkInvariants', () => {
    applyAndCheck(state, clickTarget(tool, state));
  });
});

// ── Suite 2: 3 downstream clips ───────────────────────────────────────────────

describe('RippleDeleteTool — 3 downstream clips: 4 ops, correct order', () => {
  //  target: [100,300) — deletedDuration=200
  //  ds-0:   [300,400) → shifts to [100,200)
  //  ds-1:   [400,500) → shifts to [200,300)
  //  ds-2:   [500,600) → shifts to [300,400)
  let tool: RippleDeleteTool;
  let state: TimelineState;

  beforeEach(() => {
    tool  = new RippleDeleteTool();
    state = makeState([300, 400, 500]);
  });

  it('operations.length === 4 (DELETE + 3×MOVE)', () => {
    const tx = clickTarget(tool, state);
    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(4);
  });

  it('operations[0].type === DELETE_CLIP always', () => {
    const tx = clickTarget(tool, state);
    expect(tx!.operations[0]!.type).toBe('DELETE_CLIP');
    const op = tx!.operations[0]!;
    if (op.type === 'DELETE_CLIP') expect(op.clipId).toBe(TARGET_ID);
  });

  it('MOVE_CLIP sort: leftmost downstream clip (ds-0 at 300) appears first', () => {
    const tx  = clickTarget(tool, state);
    const op1 = tx!.operations[1]!;
    expect(op1.type).toBe('MOVE_CLIP');
    if (op1.type === 'MOVE_CLIP') expect(op1.clipId).toBe(toClipId('clip-ds-0'));
  });

  it('each downstream clip shifts left by exactly deletedDuration (200)', () => {
    const tx = clickTarget(tool, state);
    const origStarts    = [300, 400, 500];
    const deletedDuration = 200;

    const moves = tx!.operations.filter(o => o.type === 'MOVE_CLIP');
    expect(moves).toHaveLength(3);

    moves.forEach((op, i) => {
      if (op.type === 'MOVE_CLIP') {
        expect(op.newTimelineStart).toBe(toFrame(origStarts[i]! - deletedDuration));
      }
    });
  });

  it('full operation order: DELETE, ds-0 MOVE, ds-1 MOVE, ds-2 MOVE', () => {
    const tx  = clickTarget(tool, state);
    const ops = tx!.operations;

    expect(ops[0]!.type).toBe('DELETE_CLIP');
    expect(ops[1]!.type).toBe('MOVE_CLIP');
    expect(ops[2]!.type).toBe('MOVE_CLIP');
    expect(ops[3]!.type).toBe('MOVE_CLIP');

    // ds-0 → ds-1 → ds-2 (ascending timelineStart = left-to-right)
    if (ops[1]!.type === 'MOVE_CLIP') expect(ops[1]!.newTimelineStart).toBe(toFrame(100));
    if (ops[2]!.type === 'MOVE_CLIP') expect(ops[2]!.newTimelineStart).toBe(toFrame(200));
    if (ops[3]!.type === 'MOVE_CLIP') expect(ops[3]!.newTimelineStart).toBe(toFrame(300));
  });

  it('dispatch accepted + checkInvariants', () => {
    applyAndCheck(state, clickTarget(tool, state));
  });
});

// ── Suite 3: Empty space click ────────────────────────────────────────────────

describe('RippleDeleteTool — empty space click: null', () => {
  it('clipId=null on pointerDown → onPointerUp returns null', () => {
    const state = makeState();
    const tool  = new RippleDeleteTool();
    const ctx   = makeCtx(state);

    tool.onPointerDown(makeEv({ clipId: null }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: null }), ctx);
    expect(tx).toBeNull();
  });
});

// ── Suite 4: Defensive — clip missing from state ──────────────────────────────

describe('RippleDeleteTool — defensive: clip missing at onPointerUp', () => {
  it('pendingClipId set but clip not in ctx.state → null', () => {
    const state = makeState();
    const tool  = new RippleDeleteTool();
    const ctx   = makeCtx(state);

    // Record a valid clipId at pointerDown
    tool.onPointerDown(makeEv({ clipId: TARGET_ID }), ctx);

    // Then provide a state with the clip REMOVED (simulate another tool acting first)
    const emptyState = makeState([]);   // makeState with empty track? Actually we need
    // a state that simply has no clip-target. Use a fresh state with a different clip.
    // Easiest: build a state where track has no clips at all.
    const stateWithoutClip = makeState([]);
    // Remove target clip — rebuild with downstream only (no target)
    const asset = makeAsset();
    const track = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips: [] });
    const tl    = createTimeline({ id: 'tl', name: 'T', fps: frameRate(30), duration: toFrame(9000), startTimecode: toTimecode('00:00:00:00'), tracks: [track] });
    const ghostState = createTimelineState({ timeline: tl, assetRegistry: new Map([[ASSET_ID, asset]]) });

    const ctxWithMissingClip = makeCtx(ghostState);
    const tx = tool.onPointerUp(makeEv({ clipId: TARGET_ID }), ctxWithMissingClip);
    expect(tx).toBeNull();
  });
});

// ── Suite 5: No provisional state ────────────────────────────────────────────

describe('RippleDeleteTool — no provisional state', () => {
  it('onPointerMove always returns null (before drag)', () => {
    const state = makeState();
    const tool  = new RippleDeleteTool();
    const ctx   = makeCtx(state);
    expect(tool.onPointerMove(makeEv({ clipId: TARGET_ID }), ctx)).toBeNull();
  });

  it('onPointerMove always returns null (mid-drag)', () => {
    const state = makeState();
    const tool  = new RippleDeleteTool();
    const ctx   = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: TARGET_ID }), ctx);
    expect(tool.onPointerMove(makeEv({ clipId: TARGET_ID }), ctx)).toBeNull();
  });

  it('onPointerMove always returns null (over empty space)', () => {
    const state = makeState();
    const tool  = new RippleDeleteTool();
    const ctx   = makeCtx(state);
    expect(tool.onPointerMove(makeEv({ clipId: null }), ctx)).toBeNull();
  });
});

// ── Suite 6: Cursor and structural ───────────────────────────────────────────

describe('RippleDeleteTool — cursor and structural', () => {
  it('getCursor returns pointer when hovering clip', () => {
    const state = makeState();
    const tool  = new RippleDeleteTool();
    const ctx   = makeCtx(state);
    tool.onPointerMove(makeEv({ clipId: TARGET_ID }), ctx);
    expect(tool.getCursor(ctx)).toBe('pointer');
  });

  it('getCursor returns default when over empty space', () => {
    const state = makeState();
    const tool  = new RippleDeleteTool();
    const ctx   = makeCtx(state);
    tool.onPointerMove(makeEv({ clipId: null }), ctx);
    expect(tool.getCursor(ctx)).toBe('default');
  });

  it('onCancel resets pendingClipId — subsequent pointerUp returns null', () => {
    const state = makeState();
    const tool  = new RippleDeleteTool();
    const ctx   = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: TARGET_ID }), ctx);
    tool.onCancel();
    const tx = tool.onPointerUp(makeEv({ clipId: TARGET_ID }), ctx);
    expect(tx).toBeNull();
  });

  it('getSnapCandidateTypes returns empty array', () => {
    expect(new RippleDeleteTool().getSnapCandidateTypes()).toHaveLength(0);
  });

  it('has correct id and empty shortcutKey', () => {
    const tool = new RippleDeleteTool();
    expect(tool.id).toBe('ripple-delete');
    expect(tool.shortcutKey).toBe('');
  });
});
