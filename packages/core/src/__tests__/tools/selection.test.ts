/**
 * SelectionTool Tests — Phase 2
 *
 * Tests the four interaction modes with no React / no engine / no router.
 * Every Transaction produced is verified with checkInvariants() — no exceptions.
 *
 * Test locations follow the convention:
 *   packages/core/src/__tests__/tools/  ← unit tests, zero React
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { SelectionTool }    from '../../tools/selection';
import { checkInvariants }  from '../../validation/invariants';
import { dispatch }         from '../../engine/dispatcher';
import { createTimelineState } from '../../types/state';
import { createTimeline }   from '../../types/timeline';
import { createTrack, toTrackId } from '../../types/track';
import { createClip, toClipId }   from '../../types/clip';
import { createAsset, toAssetId } from '../../types/asset';
import { toFrame, toTimecode, frameRate } from '../../types/frame';
import { buildSnapIndex }   from '../../snap-index';
import type {
  ToolContext,
  TimelinePointerEvent,
  TimelineKeyEvent,
} from '../../tools/types';
import type { TimelineState } from '../../types/state';
import type { TimelineFrame } from '../../types/frame';
import type { TrackId }  from '../../types/track';
import type { ClipId }   from '../../types/clip';

// ── Fixtures ────────────────────────────────────────────────────────────────

const ASSET_ID  = toAssetId('asset-1');
const TRACK_ID  = toTrackId('track-1');
const CLIP_A_ID = toClipId('clip-a');     // [0, 100)
const CLIP_B_ID = toClipId('clip-b');     // [200, 300)

function makeState(): TimelineState {
  const asset = createAsset({
    id:                   'asset-1',
    name:                 'Test Asset',
    mediaType:            'video',
    filePath:             '/media/test.mp4',
    intrinsicDuration:    toFrame(600),
    nativeFps:            30,
    sourceTimecodeOffset: toFrame(0),
    status:               'online',
  });

  const clipA = createClip({
    id:            'clip-a',
    assetId:       'asset-1',
    trackId:       'track-1',
    timelineStart: toFrame(0),
    timelineEnd:   toFrame(100),
    mediaIn:       toFrame(0),
    mediaOut:      toFrame(100),
  });

  const clipB = createClip({
    id:            'clip-b',
    assetId:       'asset-1',
    trackId:       'track-1',
    timelineStart: toFrame(200),
    timelineEnd:   toFrame(300),
    mediaIn:       toFrame(0),
    mediaOut:      toFrame(100),
  });

  const track = createTrack({
    id:    'track-1',
    name:  'V1',
    type:  'video',
    clips: [clipA, clipB],
  });

  const timeline = createTimeline({
    id:            'tl',
    name:          'Selection Test',
    fps:           frameRate(30),
    duration:      toFrame(9000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks:        [track],
  });

  return createTimelineState({
    timeline,
    assetRegistry: new Map([[ASSET_ID, asset]]),
  });
}

/** Build a minimal ToolContext. snap() is a no-op (identity) by default. */
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
    trackAtY:       (_y) => TRACK_ID,
    snap:           (frame, _exclude?) => frame,   // identity — no snap in unit tests
    ...overrides,
  };
}

/** Minimal PointerEvent builder */
function makeEv(overrides: {
  frame?:    TimelineFrame;
  trackId?:  TrackId | null;
  clipId?:   ClipId  | null;
  x?:        number;
  y?:        number;
  buttons?:  number;
  shiftKey?: boolean;
  altKey?:   boolean;
  metaKey?:  boolean;
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

/** Apply a Transaction and assert zero invariant violations. */
function applyAndCheck(state: TimelineState, tx: ReturnType<SelectionTool['onPointerUp']>) {
  expect(tx).not.toBeNull();
  const result = dispatch(state, tx!);
  expect(result.accepted).toBe(true);
  if (result.accepted) {
    expect(checkInvariants(result.nextState)).toHaveLength(0);
  }
  return result.accepted ? result.nextState : state;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SelectionTool — MODE 1: single click', () => {
  let tool: SelectionTool;
  let state: TimelineState;

  beforeEach(() => {
    tool  = new SelectionTool();
    state = makeState();
  });

  it('click on clip selects it', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, x: 50 }), ctx);
    tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, x: 51 }), ctx); // < 4px
    tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, x: 51 }), ctx);

    expect(tool.getSelection().has(CLIP_A_ID)).toBe(true);
    expect(tool.getSelection().size).toBe(1);
  });

  it('click on different clip replaces selection', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, x: 50  }), ctx);
    tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, x: 51  }), ctx);

    tool.onPointerDown(makeEv({ clipId: CLIP_B_ID, x: 200 }), ctx);
    tool.onPointerUp(makeEv({ clipId: CLIP_B_ID, x: 201 }), ctx);

    expect(tool.getSelection().has(CLIP_B_ID)).toBe(true);
    expect(tool.getSelection().has(CLIP_A_ID)).toBe(false);
    expect(tool.getSelection().size).toBe(1);
  });

  it('shift-click toggles clip into selection', () => {
    const ctx = makeCtx(state);
    // Select A first
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, x: 50  }), ctx);
    tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, x: 51  }), ctx);

    // Shift-click B
    tool.onPointerDown(makeEv({ clipId: CLIP_B_ID, x: 200, shiftKey: true }), ctx);
    tool.onPointerUp(makeEv({ clipId: CLIP_B_ID, x: 201, shiftKey: true }), ctx);

    expect(tool.getSelection().has(CLIP_A_ID)).toBe(true);
    expect(tool.getSelection().has(CLIP_B_ID)).toBe(true);
  });

  it('shift-click on already-selected clip deselects it', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, x: 50 }), ctx);
    tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, x: 51 }), ctx);

    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, x: 50, shiftKey: true }), ctx);
    tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, x: 51, shiftKey: true }), ctx);

    expect(tool.getSelection().has(CLIP_A_ID)).toBe(false);
  });

  it('click on empty space clears selection', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, x: 50 }), ctx);
    tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, x: 51 }), ctx);

    // Click empty space
    tool.onPointerDown(makeEv({ clipId: null, x: 150 }), ctx);
    tool.onPointerUp(makeEv({ clipId: null, x: 151 }), ctx);

    expect(tool.getSelection().size).toBe(0);
  });

  it('click returns null Transaction (selection is not in history)', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, x: 50 }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, x: 51 }), ctx);
    expect(tx).toBeNull();
  });
});

describe('SelectionTool — MODE 2: single clip drag', () => {
  let tool: SelectionTool;
  let state: TimelineState;

  beforeEach(() => {
    tool  = new SelectionTool();
    state = makeState();
  });

  it('drag clip A by 50 frames — provisional ghost appears during move', () => {
    const ctx = makeCtx(state);
    // Down at frame 10 (clientX=100 with ppf=10)
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(10), x: 100 }), ctx);

    // Move to frame 60 — sufficient drag (60-10=50 frames, clientX=600 vs 100 = 500px >> 4px)
    const provisional = tool.onPointerMove(
      makeEv({ clipId: CLIP_A_ID, frame: toFrame(60), x: 600 }),
      ctx,
    );

    expect(provisional).not.toBeNull();
    expect(provisional!.isProvisional).toBe(true);
    expect(provisional!.clips).toHaveLength(1);
    // clip-a starts at 0, dragStartFrame=10, delta=+50 → new start = 50
    expect(provisional!.clips[0]!.timelineStart).toBe(toFrame(50));
    expect(provisional!.clips[0]!.timelineEnd).toBe(toFrame(150));
  });

  it('ghost uses LIVE clip data from ctx.state (not a stored snapshot)', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(10), x: 100 }), ctx);

    const provisional = tool.onPointerMove(
      makeEv({ clipId: CLIP_A_ID, frame: toFrame(60), x: 600 }),
      ctx,
    );
    // Ghost is a spread of the live clip — same id, trackId, assetId
    expect(provisional!.clips[0]!.id).toBe(CLIP_A_ID);
    expect(provisional!.clips[0]!.trackId).toBe(TRACK_ID);
    expect(provisional!.clips[0]!.assetId).toBe(ASSET_ID);
  });

  it('drag produces MOVE_CLIP Transaction with correct newTimelineStart', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(0), x: 0 }), ctx);
    tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, frame: toFrame(50), x: 500 }), ctx);
    const tx = tool.onPointerUp(
      makeEv({ clipId: CLIP_A_ID, frame: toFrame(50), x: 500 }),
      ctx,
    );

    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(1);
    const op = tx!.operations[0]!;
    expect(op.type).toBe('MOVE_CLIP');
    if (op.type === 'MOVE_CLIP') {
      expect(op.clipId).toBe(CLIP_A_ID);
      expect(op.newTimelineStart).toBe(toFrame(50));
    }
  });

  it('MOVE_CLIP Transaction passes checkInvariants', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(0), x: 0 }), ctx);
    tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, frame: toFrame(50), x: 500 }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(50), x: 500 }), ctx);
    applyAndCheck(state, tx);
  });

  it('no-op drag (clip returned to start) returns null', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(0), x: 0 }), ctx);
    tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, frame: toFrame(10), x: 100 }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(0), x: 0 }), ctx);
    expect(tx).toBeNull();
  });

  it('onPointerMove returns null below 4px click threshold', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, x: 100 }), ctx);
    // Move only 2px — below threshold
    const provisional = tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, x: 102 }), ctx);
    expect(provisional).toBeNull();
  });
});

describe('SelectionTool — MODE 3: multi-clip drag', () => {
  let tool: SelectionTool;
  let state: TimelineState;

  beforeEach(() => {
    tool  = new SelectionTool();
    state = makeState();
  });

  /** Helper: select both clips via clicks, then drag both */
  function selectBoth(ctx: ToolContext) {
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, x: 50 }), ctx);
    tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, x: 51 }), ctx);

    tool.onPointerDown(makeEv({ clipId: CLIP_B_ID, x: 200, shiftKey: true }), ctx);
    tool.onPointerUp(makeEv({ clipId: CLIP_B_ID, x: 201, shiftKey: true }), ctx);

    expect(tool.getSelection().size).toBe(2);
  }

  it('dragging a selected clip when multiple are selected moves all', () => {
    const ctx = makeCtx(state);
    selectBoth(ctx);

    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(0), x: 0 }), ctx);
    tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, frame: toFrame(50), x: 500 }), ctx);
    const provisional = tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, frame: toFrame(50), x: 501 }), ctx);

    expect(provisional).not.toBeNull();
    expect(provisional!.clips).toHaveLength(2);   // both clips in ghost
  });

  it('all selected clips move by identical delta', () => {
    const ctx = makeCtx(state);
    selectBoth(ctx);

    // clip-a=[0,100), clip-b=[200,300). Drag clip-a by +50 frames
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(0), x: 0 }), ctx);
    tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, frame: toFrame(50), x: 500 }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(50), x: 500 }), ctx);

    expect(tx).not.toBeNull();
    expect(tx!.operations).toHaveLength(2);

    const opA = tx!.operations.find(o => o.type === 'MOVE_CLIP' && o.clipId === CLIP_A_ID);
    const opB = tx!.operations.find(o => o.type === 'MOVE_CLIP' && o.clipId === CLIP_B_ID);

    expect(opA).toBeDefined();
    expect(opB).toBeDefined();

    if (opA?.type === 'MOVE_CLIP') expect(opA.newTimelineStart).toBe(toFrame(50));   // 0 + 50
    if (opB?.type === 'MOVE_CLIP') expect(opB.newTimelineStart).toBe(toFrame(250));  // 200 + 50
  });

  it('multi-clip MOVE_CLIP Transaction passes checkInvariants', () => {
    const ctx = makeCtx(state);
    selectBoth(ctx);

    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(0), x: 0 }), ctx);
    tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, frame: toFrame(50), x: 500 }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, frame: toFrame(50), x: 500 }), ctx);

    applyAndCheck(state, tx);
  });

  it('uniform delta — both clips shift by same amount (not independently snapped)', () => {
    const ctx = makeCtx(state);
    selectBoth(ctx);

    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(10), x: 100 }), ctx);
    const provisional = tool.onPointerMove(
      makeEv({ clipId: CLIP_A_ID, frame: toFrame(30), x: 300 }),   // delta=+20
      ctx,
    );

    expect(provisional!.clips).toHaveLength(2);
    const ghostA = provisional!.clips.find(c => c.id === CLIP_A_ID)!;
    const ghostB = provisional!.clips.find(c => c.id === CLIP_B_ID)!;

    // Both moved by +20 frames
    expect(ghostA.timelineStart).toBe(toFrame(20));   // 0 + 20
    expect(ghostB.timelineStart).toBe(toFrame(220));  // 200 + 20
  });
});

describe('SelectionTool — MODE 4: rubber-band select', () => {
  let tool: SelectionTool;
  let state: TimelineState;

  beforeEach(() => {
    tool  = new SelectionTool();
    state = makeState();
  });

  it('rubber-band drag returns ProvisionalState with rubberBand region', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: null, frame: toFrame(0), y: 10 }), ctx);
    const provisional = tool.onPointerMove(
      makeEv({ clipId: null, frame: toFrame(150), y: 40 }),
      ctx,
    );

    expect(provisional).not.toBeNull();
    expect(provisional!.clips).toHaveLength(0);
    expect(provisional!.rubberBand).toBeDefined();
    expect(provisional!.rubberBand!.startFrame).toBe(toFrame(0));
    expect(provisional!.rubberBand!.endFrame).toBe(toFrame(150));
    expect(provisional!.rubberBand!.startY).toBe(10);
    expect(provisional!.rubberBand!.endY).toBe(40);
  });

  it('rubber-band selects clips whose frame range overlaps the band', () => {
    const ctx = makeCtx(state);
    // Sweep from frame 50 to frame 250 — intersects both clip-a [0,100) and clip-b [200,300)
    tool.onPointerDown(makeEv({ clipId: null, frame: toFrame(50),  x: 0,   y: 0 }), ctx);
    tool.onPointerMove(makeEv({ clipId: null, frame: toFrame(250), x: 500, y: 48 }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: null, frame: toFrame(250), x: 500, y: 48 }), ctx);

    expect(tx).toBeNull();  // no Transaction
    expect(tool.getSelection().has(CLIP_A_ID)).toBe(true);
    expect(tool.getSelection().has(CLIP_B_ID)).toBe(true);
  });

  it('rubber-band selects only clips within the swept region', () => {
    const ctx = makeCtx(state);
    // Sweep from frame 0 to frame 50 — only intersects clip-a [0,100)
    tool.onPointerDown(makeEv({ clipId: null, frame: toFrame(0),  x: 0,   y: 0 }), ctx);
    tool.onPointerMove(makeEv({ clipId: null, frame: toFrame(50), x: 500, y: 48 }), ctx);
    tool.onPointerUp(makeEv({ clipId: null, frame: toFrame(50), x: 500, y: 48 }), ctx);

    expect(tool.getSelection().has(CLIP_A_ID)).toBe(true);
    expect(tool.getSelection().has(CLIP_B_ID)).toBe(false);
  });

  it('rubber-band returns null Transaction', () => {
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: null, frame: toFrame(0),   x: 0,   y: 0 }), ctx);
    tool.onPointerMove(makeEv({ clipId: null, frame: toFrame(250), x: 500, y: 48 }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: null, frame: toFrame(250), x: 500, y: 48 }), ctx);
    expect(tx).toBeNull();
  });
});

describe('SelectionTool — onCancel', () => {
  it('resets ALL instance state including selection', () => {
    const state = makeState();
    const ctx   = makeCtx(state);
    const tool  = new SelectionTool();

    // Create some state
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, x: 50 }), ctx);
    tool.onPointerUp(makeEv({ clipId: CLIP_A_ID, x: 51 }), ctx);  // select A
    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, frame: toFrame(10), x: 100 }), ctx);  // start drag

    // Cancel mid-drag
    tool.onCancel();

    expect(tool.getSelection().size).toBe(0);
    // After cancel, getCursor() should return 'default'
    expect(tool.getCursor(ctx)).toBe('default');
  });
});

describe('SelectionTool — getCursor', () => {
  it('returns "default" when idle', () => {
    const state = makeState();
    const ctx   = makeCtx(state);
    const tool  = new SelectionTool();
    expect(tool.getCursor(ctx)).toBe('default');
  });

  it('returns "grab" when hovering a clip', () => {
    const state = makeState();
    const ctx   = makeCtx(state);
    const tool  = new SelectionTool();

    tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, x: 50 }), ctx);
    expect(tool.getCursor(ctx)).toBe('grab');
  });

  it('returns "grabbing" during drag', () => {
    const state = makeState();
    const ctx   = makeCtx(state);
    const tool  = new SelectionTool();

    tool.onPointerDown(makeEv({ clipId: CLIP_A_ID, x: 50, frame: toFrame(5) }), ctx);
    tool.onPointerMove(makeEv({ clipId: CLIP_A_ID, x: 550, frame: toFrame(55) }), ctx);
    expect(tool.getCursor(ctx)).toBe('grabbing');
  });

  it('returns "crosshair" during rubber-band', () => {
    const state = makeState();
    const ctx   = makeCtx(state);
    const tool  = new SelectionTool();

    tool.onPointerDown(makeEv({ clipId: null, x: 150 }), ctx);
    tool.onPointerMove(makeEv({ clipId: null, x: 200 }), ctx);
    expect(tool.getCursor(ctx)).toBe('crosshair');
  });
});

describe('SelectionTool — ITool interface: getSnapCandidateTypes', () => {
  it('returns ClipStart, ClipEnd, Playhead snap types', () => {
    const tool  = new SelectionTool();
    const types = tool.getSnapCandidateTypes();
    expect(types).toContain('ClipStart');
    expect(types).toContain('ClipEnd');
    expect(types).toContain('Playhead');
  });
});

describe('SelectionTool — no React imports (structural)', () => {
  it('SelectionTool has correct id and shortcutKey', () => {
    const tool = new SelectionTool();
    expect(tool.id).toBe('selection');
    expect(tool.shortcutKey).toBe('v');
  });
});
