/**
 * SlideTool Tests — Phase 7 Step 5
 *
 * Fixture: one video track, three clips — clip1 [0,200), clip2 [300,500), clip3 [500,700].
 * Slide range for clip2: start 200..300 (left neighbor ends at 200, right starts at 500).
 *
 * 1. onPointerDown on clip2 sets drag state (provisional on move)
 * 2. onPointerDown on empty: no drag
 * 3. onPointerMove shows provisional at new position
 * 4. onPointerMove clamps to left neighbor boundary
 * 5. onPointerMove clamps to right neighbor boundary
 * 6. onPointerUp dispatches MOVE_CLIP for clip2
 * 7. onPointerUp with no movement: no dispatch
 * 8. onPointerUp includes neighbor adjustments in transaction
 * 9. onCancel resets state
 * 10. capture-before-reset: no drag after onPointerUp
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { SlideTool } from '../../tools/slide-tool';
import { checkInvariants } from '../../validation/invariants';
import { dispatch } from '../../engine/dispatcher';
import { createTimelineState } from '../../types/state';
import { createTimeline } from '../../types/timeline';
import { createTrack, toTrackId } from '../../types/track';
import { createClip, toClipId } from '../../types/clip';
import { createAsset, toAssetId } from '../../types/asset';
import { toFrame, toTimecode, frameRate } from '../../types/frame';
import { buildSnapIndex } from '../../snap-index';
import type { ToolContext, TimelinePointerEvent } from '../../tools/types';
import type { TimelineState } from '../../types/state';
import type { TrackId } from '../../types/track';
import type { ClipId } from '../../types/clip';

const TRACK_ID = toTrackId('track-1');
const ASSET_ID = toAssetId('asset-1');
const CLIP1_ID = toClipId('clip1');
const CLIP2_ID = toClipId('clip2');
const CLIP3_ID = toClipId('clip3');

const PX_PER_FRAME = 10;

function makeState(): TimelineState {
  const asset = createAsset({
    id: 'asset-1',
    name: 'Test',
    mediaType: 'video',
    filePath: '/media/test.mp4',
    intrinsicDuration: toFrame(2000),
    nativeFps: 30,
    sourceTimecodeOffset: toFrame(0),
    status: 'online',
  });
  const clip1 = createClip({
    id: 'clip1',
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(0),
    timelineEnd: toFrame(200),
    mediaIn: toFrame(0),
    mediaOut: toFrame(200),
  });
  const clip2 = createClip({
    id: 'clip2',
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(300),
    timelineEnd: toFrame(500),
    mediaIn: toFrame(0),
    mediaOut: toFrame(200),
  });
  const clip3 = createClip({
    id: 'clip3',
    assetId: 'asset-1',
    trackId: 'track-1',
    timelineStart: toFrame(500),
    timelineEnd: toFrame(700),
    mediaIn: toFrame(0),
    mediaOut: toFrame(200),
  });
  const track = createTrack({
    id: 'track-1',
    name: 'V1',
    type: 'video',
    clips: [clip1, clip2, clip3],
  });
  const timeline = createTimeline({
    id: 'tl',
    name: 'Slide Test',
    fps: frameRate(30),
    duration: toFrame(9000),
    startTimecode: toTimecode('00:00:00:00'),
    tracks: [track],
  });
  return createTimelineState({
    timeline,
    assetRegistry: new Map([[ASSET_ID, asset]]),
  });
}

function makeCtx(state: TimelineState, overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    state,
    snapIndex: buildSnapIndex(state, toFrame(0)),
    pixelsPerFrame: PX_PER_FRAME,
    modifiers: { shift: false, alt: false, ctrl: false, meta: false },
    frameAtX: (x) => toFrame(Math.round(x / PX_PER_FRAME)),
    trackAtY: () => TRACK_ID,
    snap: (frame) => frame,
    ...overrides,
  };
}

function makeEv(overrides: {
  frame?: number;
  trackId?: TrackId | null;
  clipId?: ClipId | null;
  x?: number;
  y?: number;
} = {}): TimelinePointerEvent {
  const frame = overrides.frame ?? 0;
  return {
    frame: toFrame(frame),
    trackId: overrides.trackId ?? TRACK_ID,
    clipId: overrides.clipId ?? null,
    x: overrides.x ?? frame * PX_PER_FRAME,
    y: overrides.y ?? 24,
    buttons: 1,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  };
}

describe('SlideTool — onPointerDown on clip2 sets draggingClipId', () => {
  it('after pointerDown on clip2, pointerMove returns provisional', () => {
    const tool = new SlideTool();
    const state = makeState();
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP2_ID, x: 3500, frame: 350 }), ctx);
    const prov = tool.onPointerMove(makeEv({ clipId: CLIP2_ID, x: 3600, frame: 360 }), ctx);
    expect(prov).not.toBeNull();
    expect(prov!.clips).toHaveLength(1);
    expect(prov!.clips[0]!.id).toBe(CLIP2_ID);
    expect(prov!.isProvisional).toBe(true);
  });
});

describe('SlideTool — onPointerDown on empty space: no drag', () => {
  it('pointerDown with clipId null then pointerMove returns null', () => {
    const tool = new SlideTool();
    const state = makeState();
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: null, x: 100 }), ctx);
    const prov = tool.onPointerMove(makeEv({ clipId: null, x: 200 }), ctx);
    expect(prov).toBeNull();
  });
});

describe('SlideTool — onPointerMove shows provisional at new position', () => {
  it('ghost clip has timelineStart moved by delta frames', () => {
    const tool = new SlideTool();
    const state = makeState();
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP2_ID, x: 3000, frame: 300 }), ctx);
    const prov = tool.onPointerMove(makeEv({ clipId: CLIP2_ID, x: 2500, frame: 250 }), ctx);
    expect(prov).not.toBeNull();
    const ghost = prov!.clips[0]!;
    expect((ghost.timelineStart as number)).toBe(250);
    expect((ghost.timelineEnd as number)).toBe(450);
  });
});

describe('SlideTool — onPointerMove clamps to left neighbor boundary', () => {
  it('slide left past left neighbor: clamped to left.timelineEnd', () => {
    const tool = new SlideTool();
    const state = makeState();
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP2_ID, x: 3000, frame: 300 }), ctx);
    const prov = tool.onPointerMove(makeEv({ clipId: CLIP2_ID, x: 1000, frame: 100 }), ctx);
    expect(prov).not.toBeNull();
    const ghost = prov!.clips[0]!;
    expect((ghost.timelineStart as number)).toBe(200);
    expect((ghost.timelineEnd as number)).toBe(400);
  });
});

describe('SlideTool — onPointerMove clamps to right neighbor boundary', () => {
  it('slide right past right neighbor: clamped so clip end does not pass right start', () => {
    const tool = new SlideTool();
    const state = makeState();
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP2_ID, x: 3000, frame: 300 }), ctx);
    const prov = tool.onPointerMove(makeEv({ clipId: CLIP2_ID, x: 4000, frame: 400 }), ctx);
    expect(prov).not.toBeNull();
    const ghost = prov!.clips[0]!;
    expect((ghost.timelineStart as number)).toBe(300);
    expect((ghost.timelineEnd as number)).toBe(500);
  });
});

describe('SlideTool — onPointerUp dispatches MOVE_CLIP for clip2', () => {
  it('transaction contains MOVE_CLIP for the slid clip', () => {
    const tool = new SlideTool();
    const state = makeState();
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP2_ID, x: 3000, frame: 300 }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP2_ID, x: 2500, frame: 250 }), ctx);
    expect(tx).not.toBeNull();
    const moveOps = tx!.operations.filter((op) => op.type === 'MOVE_CLIP' && op.clipId === CLIP2_ID);
    expect(moveOps.length).toBeGreaterThanOrEqual(1);
    expect(moveOps[0]!.type).toBe('MOVE_CLIP');
    if (moveOps[0]!.type === 'MOVE_CLIP') {
      expect((moveOps[0].newTimelineStart as number)).toBe(250);
    }
  });
});

describe('SlideTool — onPointerUp with no movement: no dispatch', () => {
  it('pointerUp at same x as pointerDown returns null', () => {
    const tool = new SlideTool();
    const state = makeState();
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP2_ID, x: 3000, frame: 300 }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP2_ID, x: 3000, frame: 300 }), ctx);
    expect(tx).toBeNull();
  });
});

describe('SlideTool — onPointerUp includes neighbor adjustments in transaction', () => {
  it('transaction includes RESIZE_CLIP for left and MOVE_CLIP+RESIZE_CLIP for right', () => {
    const tool = new SlideTool();
    const state = makeState();
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP2_ID, x: 3000, frame: 300 }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP2_ID, x: 2500, frame: 250 }), ctx);
    expect(tx).not.toBeNull();
    const resizeLeft = tx!.operations.filter(
      (op) => op.type === 'RESIZE_CLIP' && op.clipId === CLIP1_ID,
    );
    const moveRight = tx!.operations.filter(
      (op) => op.type === 'MOVE_CLIP' && op.clipId === CLIP3_ID,
    );
    const resizeRight = tx!.operations.filter(
      (op) => op.type === 'RESIZE_CLIP' && op.clipId === CLIP3_ID,
    );
    expect(resizeLeft.length).toBe(1);
    expect(moveRight.length).toBe(1);
    expect(resizeRight.length).toBe(1);
  });

  it('applied transaction passes checkInvariants', () => {
    const tool = new SlideTool();
    const state = makeState();
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP2_ID, x: 3000, frame: 300 }), ctx);
    const tx = tool.onPointerUp(makeEv({ clipId: CLIP2_ID, x: 2500, frame: 250 }), ctx);
    expect(tx).not.toBeNull();
    const result = dispatch(state, tx!);
    expect(result.accepted).toBe(true);
    if (result.accepted) {
      expect(checkInvariants(result.nextState)).toHaveLength(0);
    }
  });
});

describe('SlideTool — onCancel resets state and clears provisional', () => {
  it('after onCancel, pointerMove returns null', () => {
    const tool = new SlideTool();
    const state = makeState();
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP2_ID, x: 3000 }), ctx);
    tool.onCancel();
    const prov = tool.onPointerMove(makeEv({ clipId: CLIP2_ID, x: 2500 }), ctx);
    expect(prov).toBeNull();
  });
});

describe('SlideTool — capture-before-reset: draggingClipId null after onPointerUp', () => {
  it('after pointerUp, subsequent pointerMove returns null (no drag)', () => {
    const tool = new SlideTool();
    const state = makeState();
    const ctx = makeCtx(state);
    tool.onPointerDown(makeEv({ clipId: CLIP2_ID, x: 3000 }), ctx);
    tool.onPointerUp(makeEv({ clipId: CLIP2_ID, x: 2500 }), ctx);
    const prov = tool.onPointerMove(makeEv({ clipId: CLIP2_ID, x: 2000 }), ctx);
    expect(prov).toBeNull();
  });
});
