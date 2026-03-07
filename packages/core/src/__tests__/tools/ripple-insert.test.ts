/**
 * RippleInsertTool Tests — Phase 2 Step 7
 *
 * Covers all items from the approved test plan:
 *   □ 3 clips at drop point: 3× MOVE_CLIP (right-to-left) then INSERT_CLIP — exact order
 *   □ MOVE_CLIP values: each clip shifts by exactly insertDuration
 *   □ INSERT_CLIP lands at clampedDropFrame
 *   □ No clips at drop point: 1 op (INSERT_CLIP only)
 *   □ Drop at frame 0: valid, INSERT lands at 0
 *   □ Clamp: dropFrame + insertDuration > timeline.duration → clamped
 *   □ No pending insert: onPointerDown no-op, onPointerUp null
 *   □ No trackId on event: onPointerUp null
 *   □ Ghost: 1 inserted ghost + N shifted ghosts, provisional id sentinel
 *   □ Ghost provisional id never appears in committed state
 *   □ checkInvariants + dispatch.accepted on every Transaction
 *   □ setPendingInsert mid-drag: ignored (isDragging guard)
 *
 * Zero React imports.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { RippleInsertTool, _setIdGenerator } from '../../tools/ripple-insert';
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

const TRACK_ID  = toTrackId('track-1');
const ASSET_ID  = toAssetId('asset-1');
const PROVISIONAL_ID = 'provisional-insert' as ClipId;

// ── Deterministic IDs in tests ────────────────────────────────────────────────

let idCounter = 0;
beforeEach(() => {
  idCounter = 0;
  _setIdGenerator(() => `inserted-clip-${++idCounter}`);
});
afterEach(() => {
  _setIdGenerator(() => crypto.randomUUID());
});

// ── Asset and clip fixtures ───────────────────────────────────────────────────

function makeAsset() {
  return createAsset({
    id: 'asset-1', name: 'Test', mediaType: 'video',
    filePath: '/media/test.mp4',
    intrinsicDuration: toFrame(9000),
    nativeFps: 30, sourceTimecodeOffset: toFrame(0), status: 'online',
  });
}

/**
 * Build a state with existing clips at given starts (100 frames each).
 * timeline.duration = 9000 frames.
 */
function makeState(existingStarts: number[] = []): TimelineState {
  const asset  = makeAsset();
  const clips  = existingStarts.map((start, i) =>
    createClip({
      id: `clip-ex-${i}`, assetId: 'asset-1', trackId: 'track-1',
      timelineStart: toFrame(start), timelineEnd: toFrame(start + 100),
      mediaIn: toFrame(i * 100), mediaOut: toFrame(i * 100 + 100),
    }),
  );
  const track    = createTrack({ id: 'track-1', name: 'V1', type: 'video', clips });
  const timeline = createTimeline({
    id: 'tl', name: 'RippleInsert Test', fps: frameRate(30),
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
    trackId:  overrides.trackId !== undefined ? overrides.trackId : TRACK_ID,
    clipId:   overrides.clipId  !== undefined ? overrides.clipId  : null,
    x: 0, y: 24, buttons: 1,
    shiftKey: false, altKey: false, metaKey: false,
  };
}

/** Configure pending insert with 50-frame clip (mediaIn=0, mediaOut=50). */
function configureTool(tool: RippleInsertTool) {
  tool.setPendingInsert(makeAsset(), toFrame(0), toFrame(50));
}

/** Simulate a drag: configure → pointerDown → pointerUp at dropFrame. */
function doDrop(
  tool: RippleInsertTool,
  state: TimelineState,
  dropFrame: number,
  trackId: TrackId = TRACK_ID,
): ReturnType<RippleInsertTool['onPointerUp']> {
  configureTool(tool);
  const ctx = makeCtx(state);
  tool.onPointerDown(makeEv({ frame: toFrame(dropFrame), trackId }), ctx);
  return tool.onPointerUp(makeEv({ frame: toFrame(dropFrame), trackId }), ctx);
}

function applyAndCheck(state: TimelineState, tx: ReturnType<RippleInsertTool['onPointerUp']>): TimelineState {
  expect(tx).not.toBeNull();
  const result = dispatch(state, tx!);
  expect(result.accepted).toBe(true);
  if (result.accepted) {
    expect(checkInvariants(result.nextState)).toHaveLength(0);
  }
  return result.accepted ? result.nextState : state;
}

// ── Suite 1: 3 clips at drop point — exact order ─────────────────────────────

describe('RippleInsertTool — 3 downstream clips: 3× MOVE then INSERT', () => {
  //  Existing: A[300,400), B[400,500), C[500,600)
  //  Drop at 300, insertDuration=50
  //  Expected: MOVE(C→550), MOVE(B→450), MOVE(A→350), INSERT at 300

  let tool: RippleInsertTool;
  let state: TimelineState;

  beforeEach(() => {
    tool  = new RippleInsertTool();
    state = makeState([300, 400, 500]);
  });

  it('operations.length === 4 (3 MOVE + 1 INSERT)', () => {
    const tx = doDrop(tool, state, 300);
    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(4);
  });

  it('last operation is INSERT_CLIP', () => {
    const tx = doDrop(tool, state, 300);
    expect(tx!.operations[3]!.type).toBe('INSERT_CLIP');
  });

  it('first 3 ops are MOVE_CLIP, sorted right-to-left (C first, A last)', () => {
    const tx   = doDrop(tool, state, 300);
    const ops  = tx!.operations;

    expect(ops[0]!.type).toBe('MOVE_CLIP');
    expect(ops[1]!.type).toBe('MOVE_CLIP');
    expect(ops[2]!.type).toBe('MOVE_CLIP');

    // C (starts at 500) → rightmost, so FIRST
    if (ops[0]!.type === 'MOVE_CLIP') expect(ops[0]!.clipId).toBe(toClipId('clip-ex-2'));
    // B (starts at 400) → SECOND
    if (ops[1]!.type === 'MOVE_CLIP') expect(ops[1]!.clipId).toBe(toClipId('clip-ex-1'));
    // A (starts at 300) → LAST MOVE
    if (ops[2]!.type === 'MOVE_CLIP') expect(ops[2]!.clipId).toBe(toClipId('clip-ex-0'));
  });

  it('each clip shifts by exactly insertDuration (50)', () => {
    const tx          = doDrop(tool, state, 300);
    const origStarts  = [300, 400, 500];
    const insertDuration = 50;
    const moves       = tx!.operations.filter(o => o.type === 'MOVE_CLIP');

    // Build a map: clipId → newTimelineStart
    const moveMap = new Map(
      moves
        .filter(o => o.type === 'MOVE_CLIP')
        .map(o => o.type === 'MOVE_CLIP' ? [o.clipId, o.newTimelineStart] : ['', 0]),
    );

    origStarts.forEach((start, i) => {
      const id = toClipId(`clip-ex-${i}`);
      expect(moveMap.get(id)).toBe(toFrame(start + insertDuration));
    });
  });

  it('INSERT_CLIP lands at dropFrame (300)', () => {
    const tx  = doDrop(tool, state, 300);
    const ins = tx!.operations[3]!;
    if (ins.type === 'INSERT_CLIP') {
      expect(ins.clip.timelineStart).toBe(toFrame(300));
      expect(ins.clip.timelineEnd).toBe(toFrame(350));   // 300 + 50
    }
  });

  it('checkInvariants + dispatch accepted', () => {
    applyAndCheck(state, doDrop(tool, state, 300));
  });
});

// ── Suite 2: No clips at drop point ──────────────────────────────────────────

describe('RippleInsertTool — no downstream clips: 1 op (INSERT_CLIP only)', () => {
  it('operations.length === 1, type === INSERT_CLIP', () => {
    const state = makeState([]);  // empty track
    const tool  = new RippleInsertTool();
    const tx    = doDrop(tool, state, 200);

    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(1);
    expect(tx!.operations[0]!.type).toBe('INSERT_CLIP');
  });

  it('INSERT_CLIP lands at dropFrame', () => {
    const state = makeState([]);
    const tool  = new RippleInsertTool();
    const tx    = doDrop(tool, state, 200);
    const ins   = tx!.operations[0]!;
    if (ins.type === 'INSERT_CLIP') expect(ins.clip.timelineStart).toBe(toFrame(200));
  });

  it('checkInvariants + dispatch accepted', () => {
    const state = makeState([]);
    applyAndCheck(state, doDrop(new RippleInsertTool(), state, 200));
  });
});

// ── Suite 3: Drop at frame 0 ──────────────────────────────────────────────────

describe('RippleInsertTool — drop at frame 0: valid, no clamp', () => {
  it('INSERT_CLIP.timelineStart === 0', () => {
    const state = makeState([100]);  // one existing clip pushed right
    const tool  = new RippleInsertTool();
    const tx    = doDrop(tool, state, 0);

    expect(tx).not.toBeNull();
    const ins   = tx!.operations.find(o => o.type === 'INSERT_CLIP')!;
    if (ins.type === 'INSERT_CLIP') expect(ins.clip.timelineStart).toBe(toFrame(0));
  });

  it('checkInvariants + dispatch accepted', () => {
    const state = makeState([100]);
    applyAndCheck(state, doDrop(new RippleInsertTool(), state, 0));
  });
});

// ── Suite 4: Clamp — dropFrame + insertDuration > timeline.duration ───────────

describe('RippleInsertTool — clamp at timeline end', () => {
  it('dropFrame clamped so inserted clip fits within timeline (duration=9000)', () => {
    // insertDuration=50, drop at 8990 → 8990+50=9040 > 9000. Clamped to 8950.
    const state = makeState([]);
    const tool  = new RippleInsertTool();
    configureTool(tool);
    const ctx   = makeCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(8990), trackId: TRACK_ID }), ctx);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(8990), trackId: TRACK_ID }), ctx);

    expect(tx).not.toBeNull();
    const ins = tx!.operations.find(o => o.type === 'INSERT_CLIP')!;
    // clamped to 9000 - 50 = 8950
    if (ins.type === 'INSERT_CLIP') {
      expect(ins.clip.timelineStart).toBe(toFrame(8950));
      expect(ins.clip.timelineEnd).toBe(toFrame(9000));
    }
    applyAndCheck(state, tx);
  });
});

// ── Suite 5: No pending insert ────────────────────────────────────────────────

describe('RippleInsertTool — no pending insert: no-op', () => {
  it('onPointerDown without setPendingInsert → onPointerUp returns null', () => {
    const state = makeState([]);
    const tool  = new RippleInsertTool();  // no configureTool()
    const ctx   = makeCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(100), trackId: TRACK_ID }), ctx);
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(100), trackId: TRACK_ID }), ctx);
    expect(tx).toBeNull();
  });
});

// ── Suite 6: No trackId ───────────────────────────────────────────────────────

describe('RippleInsertTool — no trackId on event: null', () => {
  it('null trackId at onPointerDown → no drag, onPointerUp null', () => {
    const state = makeState([]);
    const tool  = new RippleInsertTool();
    configureTool(tool);
    const ctx   = makeCtx(state);
    tool.onPointerDown(makeEv({ trackId: null }), ctx);
    const tx = tool.onPointerUp(makeEv({ trackId: TRACK_ID }), ctx);  // even with trackId at up
    expect(tx).toBeNull();
  });

  it('null trackId at onPointerUp → null even if drag started', () => {
    const state = makeState([]);
    const tool  = new RippleInsertTool();
    configureTool(tool);
    const ctx   = makeCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(100), trackId: TRACK_ID }), ctx);
    const tx = tool.onPointerUp(makeEv({ trackId: null }), ctx);
    expect(tx).toBeNull();
  });
});

// ── Suite 7: Ghost provisional state ─────────────────────────────────────────

describe('RippleInsertTool — ProvisionalState ghost', () => {
  it('ghost has 1 inserted clip + N shifted clips', () => {
    const state = makeState([300, 400]);  // 2 existing clips
    const tool  = new RippleInsertTool();
    configureTool(tool);
    const ctx   = makeCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(300), trackId: TRACK_ID }), ctx);

    const ghost = tool.onPointerMove(makeEv({ frame: toFrame(300), trackId: TRACK_ID }), ctx);
    expect(ghost).not.toBeNull();
    expect(ghost!.isProvisional).toBe(true);
    expect(ghost!.clips).toHaveLength(3);  // 1 inserted + 2 shifted
  });

  it('ghost inserted clip uses PROVISIONAL_INSERT_ID sentinel', () => {
    const state = makeState([]);
    const tool  = new RippleInsertTool();
    configureTool(tool);
    const ctx   = makeCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(200), trackId: TRACK_ID }), ctx);

    const ghost     = tool.onPointerMove(makeEv({ frame: toFrame(200), trackId: TRACK_ID }), ctx);
    const inserted  = ghost!.clips.find(c => c.id === PROVISIONAL_ID);
    expect(inserted).not.toBeUndefined();
  });

  it('ghost inserted clip has correct timelineStart/End', () => {
    const state    = makeState([]);
    const tool     = new RippleInsertTool();
    configureTool(tool);  // mediaIn=0, mediaOut=50 → insertDuration=50
    const ctx      = makeCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(200), trackId: TRACK_ID }), ctx);

    const ghost   = tool.onPointerMove(makeEv({ frame: toFrame(200), trackId: TRACK_ID }), ctx);
    const ins     = ghost!.clips.find(c => c.id === PROVISIONAL_ID)!;
    expect(ins.timelineStart).toBe(toFrame(200));
    expect(ins.timelineEnd).toBe(toFrame(250));
  });

  it('ghost shifted clips have timelineStart offset by insertDuration', () => {
    const state = makeState([400]);  // 1 existing clip at 400
    const tool  = new RippleInsertTool();
    configureTool(tool);            // insertDuration=50
    const ctx   = makeCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(300), trackId: TRACK_ID }), ctx);

    const ghost   = tool.onPointerMove(makeEv({ frame: toFrame(300), trackId: TRACK_ID }), ctx);
    const shifted = ghost!.clips.find(c => c.id !== PROVISIONAL_ID)!;
    expect(shifted.timelineStart).toBe(toFrame(450));  // 400 + 50
    expect(shifted.timelineEnd).toBe(toFrame(550));    // 500 + 50
  });

  it('provisional id never appears in committed state after dispatch', () => {
    const state = makeState([]);
    const tool  = new RippleInsertTool();
    const tx    = doDrop(tool, state, 200);
    const nextState = applyAndCheck(state, tx);

    // Verify no clip in committed state uses the sentinel id
    for (const track of nextState.timeline.tracks) {
      for (const clip of track.clips) {
        expect(clip.id).not.toBe(PROVISIONAL_ID);
      }
    }
  });

  it('not mid-drag → onPointerMove returns null', () => {
    const state = makeState([]);
    const tool  = new RippleInsertTool();
    configureTool(tool);
    const ctx   = makeCtx(state);
    // No pointerDown
    const ghost = tool.onPointerMove(makeEv({ frame: toFrame(200), trackId: TRACK_ID }), ctx);
    expect(ghost).toBeNull();
  });
});

// ── Suite 8: setPendingInsert mid-drag guard ──────────────────────────────────

describe('RippleInsertTool — setPendingInsert mid-drag: ignored', () => {
  it('setPendingInsert during drag is silently ignored', () => {
    const state = makeState([]);
    const tool  = new RippleInsertTool();
    configureTool(tool);  // mediaIn=0, mediaOut=50

    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(100), trackId: TRACK_ID }), ctx);

    // Attempt to reconfigure mid-drag
    const newAsset = createAsset({
      id: 'asset-2', name: 'Other', mediaType: 'video',
      filePath: '/other.mp4', intrinsicDuration: toFrame(9000),
      nativeFps: 30, sourceTimecodeOffset: toFrame(0), status: 'online',
    });
    tool.setPendingInsert(newAsset, toFrame(0), toFrame(200));  // should be ignored

    const tx  = tool.onPointerUp(makeEv({ frame: toFrame(100), trackId: TRACK_ID }), ctx);
    expect(tx).not.toBeNull();

    // Inserted clip should still use original asset (asset-1) not asset-2
    const ins = tx!.operations.find(o => o.type === 'INSERT_CLIP')!;
    if (ins.type === 'INSERT_CLIP') {
      expect(ins.clip.assetId).toBe(ASSET_ID);   // original asset-1
      expect(ins.clip.mediaOut).toBe(toFrame(50));  // original mediaOut, not 200
    }
  });
});

// ── Suite 9: onCancel clears both groups ──────────────────────────────────────

describe('RippleInsertTool — onCancel', () => {
  it('onCancel clears isDragging — subsequent pointerUp returns null', () => {
    const state = makeState([]);
    const tool  = new RippleInsertTool();
    configureTool(tool);
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ frame: toFrame(100), trackId: TRACK_ID }), ctx);
    tool.onCancel();
    const tx = tool.onPointerUp(makeEv({ frame: toFrame(200), trackId: TRACK_ID }), ctx);
    expect(tx).toBeNull();
  });

  it('onCancel clears pendingAsset — getCursor returns default', () => {
    const state = makeState([]);
    const tool  = new RippleInsertTool();
    configureTool(tool);
    tool.onCancel();
    expect(tool.getCursor(makeCtx(state))).toBe('default');
  });

  it('getSnapCandidateTypes returns 4 types', () => {
    const tool = new RippleInsertTool();
    expect(tool.getSnapCandidateTypes()).toHaveLength(4);
  });

  it('has correct id and empty shortcutKey', () => {
    const tool = new RippleInsertTool();
    expect(tool.id).toBe('ripple-insert');
    expect(tool.shortcutKey).toBe('');
  });
});
